// Pulls a competition from the feed into MongoDB. Deliberately free of
// Next.js imports so the same code runs from the CLI and from a route; the
// caller decides how to revalidate.

import { type AnyBulkWriteOperation } from "mongodb";
import { getDb } from "./db";
import { fetchSeason, fetchStandings, type MappedEvent } from "./espn";
import { ladderPipeline } from "./ladder-pipeline";
import type { Competition } from "./competitions";
import type {
  CompetitionMetaDoc,
  FixtureDoc,
  LadderRow,
  Mismatch,
  StandingDoc,
} from "./types";

export type SyncReport = {
  competition: string;
  fixtures: number;
  upserted: number;
  modified: number;
  removed: number;
  unknownVenues: string[];
  reconciliation: CompetitionMetaDoc["reconciliation"];
};

const fixtureId = (feedId: string) => `espn-${feedId}`;

function involves(e: MappedEvent, team: string | undefined) {
  return !team || e.home.name === team || e.away.name === team;
}

function roundLabel(c: Competition, e: MappedEvent): string {
  switch (c.id) {
    case "wallabies": {
      const sides = [e.home.name, e.away.name];
      return sides.includes("New Zealand") && sides.includes("Australia") ? "Bledisloe Cup" : "Test";
    }
    case "rugby-world-cup-2027":
      return "Pool stage";
    default:
      return "Regular season";
  }
}

/**
 * The feed doesn't label finals. Once a season is complete, every team has
 * played the same number of regular-season games (the official table says
 * how many), so any game after a team reaches that count is a final. Finals
 * are then named from the last weekend backwards.
 */
function labelStages(events: MappedEvent[], regularGames: number | null) {
  const stage = new Map<string, { stage: FixtureDoc["stage"]; round?: string }>();
  if (!regularGames) return stage;

  const played = new Map<string, number>();
  const finals: MappedEvent[] = [];
  for (const e of events) {
    const h = played.get(e.home.id) ?? 0;
    const a = played.get(e.away.id) ?? 0;
    if (h >= regularGames || a >= regularGames) {
      finals.push(e);
    } else {
      stage.set(e.feedId, { stage: "regular" });
      played.set(e.home.id, h + 1);
      played.set(e.away.id, a + 1);
    }
  }

  const weekends: MappedEvent[][] = [];
  for (const e of finals) {
    const last = weekends.at(-1);
    const gapDays = last ? (e.kickoff.getTime() - last[0].kickoff.getTime()) / 86_400_000 : Infinity;
    if (last && gapDays < 4) last.push(e);
    else weekends.push([e]);
  }
  const names = ["Final", "Semi-final", "Quarter-final"];
  weekends.reverse().forEach((games, i) => {
    for (const g of games) stage.set(g.feedId, { stage: "finals", round: names[i] ?? "Finals" });
  });
  return stage;
}

function reconcile(ours: LadderRow[], official: StandingDoc[]) {
  const byTeam = new Map(official.map((s) => [s.teamId, s]));
  const mismatches: Mismatch[] = [];
  let matched = 0;

  ours.forEach((row, i) => {
    const o = byTeam.get(row.teamId);
    if (!o) {
      mismatches.push({ team: row.name, field: "missing from official table", ours: 1, official: 0 });
      return;
    }
    const checks: [string, number, number][] = [
      ["played", row.played, o.played],
      ["won", row.won, o.won],
      ["drawn", row.drawn, o.drawn],
      ["lost", row.lost, o.lost],
      ["pointsFor", row.pointsFor, o.pointsFor],
      ["pointsAgainst", row.pointsAgainst, o.pointsAgainst],
      ["losingBonus", row.losingBonus, o.losingBonus],
      ["points", row.competitionPoints, o.points],
      ["position", i + 1, o.rank],
    ];
    const diffs = checks.filter(([, a, b]) => a !== b);
    diffs.forEach(([field, a, b]) => mismatches.push({ team: row.name, field, ours: a, official: b }));
    if (diffs.length === 0) matched++;
  });

  return { teams: official.length, matched, mismatches };
}

export async function ensureIndexes() {
  const db = await getDb();
  await Promise.all([
    db.collection("fixtures").createIndex({ competitionId: 1, kickoff: 1 }),
    db.collection("fixtures").createIndex({ competitionId: 1, stage: 1, status: 1 }),
    db.collection("standings").createIndex({ competitionId: 1, teamId: 1 }, { unique: true }),
  ]);
}

export async function syncCompetition(c: Competition): Promise<SyncReport> {
  const db = await getDb();
  const fixtures = db.collection<FixtureDoc>("fixtures");
  const now = new Date();

  const team = "team" in c.feed ? c.feed.team : undefined;
  const events = (await fetchSeason(c.feed.league, c.feed.season))
    .filter((e) => involves(e, team))
    .sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());

  // Official table: needed for try bonus points and for reconciliation.
  let official: StandingDoc[] = [];
  if (c.hasLadder) {
    official = (await fetchStandings(c.feed.league, c.feed.season)).map((s) => ({
      _id: `${c.id}:${s.teamId}`,
      competitionId: c.id,
      syncedAt: now,
      ...s,
    }));
    if (official.length > 0) {
      await db.collection<StandingDoc>("standings").bulkWrite(
        official.map((s) => ({ replaceOne: { filter: { _id: s._id }, replacement: s, upsert: true } })),
      );
    }
  }

  const seasonComplete = events.length > 0 && events.every((e) => e.status === "result");
  const regularGames = seasonComplete && official.length ? Math.max(...official.map((s) => s.played)) : null;
  const stages = labelStages(events, regularGames);

  const ops: AnyBulkWriteOperation<FixtureDoc>[] = events.map((e) => {
    const s = stages.get(e.feedId);
    const doc: Omit<FixtureDoc, "_id"> = {
      competitionId: c.id,
      round: s?.round ?? roundLabel(c, e),
      stage: s?.stage ?? "regular",
      kickoff: e.kickoff,
      venue: e.venue,
      home: e.home,
      away: e.away,
      status: e.status,
      score: e.score,
      clock: e.clock,
      updatedAt: now,
    };
    return { updateOne: { filter: { _id: fixtureId(e.feedId) }, update: { $set: doc }, upsert: true } };
  });

  const write = ops.length ? await fixtures.bulkWrite(ops) : null;
  // Drop fixtures the feed no longer lists (rescheduled under a new id, removed).
  const removed = await fixtures.deleteMany({
    competitionId: c.id,
    _id: { $nin: events.map((e) => fixtureId(e.feedId)) },
  });

  const reconciliation = c.hasLadder
    ? reconcile(await fixtures.aggregate<LadderRow>(ladderPipeline(c.id)).toArray(), official)
    : null;

  const unknownVenues = [
    ...new Set(events.filter((e) => !e.venueKnown).map((e) => `${e.venue.name} (${e.venue.city || "?"}, ${e.venue.country || "?"})`)),
  ];

  await db.collection<CompetitionMetaDoc>("competition_meta").replaceOne(
    { _id: c.id },
    { syncedAt: now, fixtures: events.length, unknownVenues, reconciliation },
    { upsert: true },
  );

  return {
    competition: c.id,
    fixtures: events.length,
    upserted: write?.upsertedCount ?? 0,
    modified: write?.modifiedCount ?? 0,
    removed: removed.deletedCount,
    unknownVenues,
    reconciliation,
  };
}

/**
 * Write-through for live data seen by the live endpoint. Returns whether any
 * fixture changed state (kick-off, full time), which is when cached pages
 * need revalidating; score changes alone are carried by the live endpoint.
 */
export async function applyLiveEvents(c: Competition, events: MappedEvent[]) {
  const fixtures = (await getDb()).collection<FixtureDoc>("fixtures");
  const ids = events.map((e) => fixtureId(e.feedId));
  const existing = new Map((await fixtures.find({ _id: { $in: ids } }).toArray()).map((d) => [d._id, d]));

  let stateChanged = false;
  const ops: AnyBulkWriteOperation<FixtureDoc>[] = [];
  for (const e of events) {
    const doc = existing.get(fixtureId(e.feedId));
    if (!doc || doc.competitionId !== c.id) continue;
    const changed =
      doc.status !== e.status ||
      doc.clock !== e.clock ||
      doc.score?.home !== e.score?.home ||
      doc.score?.away !== e.score?.away;
    if (!changed) continue;
    if (doc.status !== e.status) stateChanged = true;
    ops.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { status: e.status, score: e.score, clock: e.clock, updatedAt: new Date() } },
      },
    });
  }
  if (ops.length) await fixtures.bulkWrite(ops);
  return { stateChanged, updated: ops.length };
}

export { fixtureId };
