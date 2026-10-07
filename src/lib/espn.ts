// Adapter for ESPN's public scoreboard/standings JSON. It's undocumented and
// unofficial, so everything it returns is treated as untrusted input: parsed
// defensively, mapped into our own types, and never passed through raw.

import { resolveVenue, type FeedVenue } from "./venues";
import type { FixtureStatus, Score, TeamRef, Venue } from "./types";

// Overridable so the live path can be exercised against a recorded/mock feed.
const BASE = process.env.ESPN_BASE_URL ?? "https://site.api.espn.com/apis";

type FeedCompetitor = {
  homeAway: "home" | "away";
  score?: string;
  team: { id: string; displayName: string; abbreviation?: string };
};

type FeedEvent = {
  id: string;
  date: string;
  competitions: {
    venue?: FeedVenue;
    status: {
      displayClock?: string;
      type: { name: string; state: "pre" | "in" | "post"; completed: boolean };
    };
    competitors: FeedCompetitor[];
  }[];
};

type FeedStat = { name: string; value: number };
type FeedStandingsEntry = { team: { id: string; displayName: string }; stats: FeedStat[] };

export type MappedEvent = {
  feedId: string;
  kickoff: Date;
  venue: Venue;
  venueKnown: boolean;
  home: TeamRef;
  away: TeamRef;
  status: FixtureStatus;
  score: Score | null;
  clock: string | null;
};

export type OfficialStanding = {
  teamId: string;
  name: string;
  rank: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  triesFor: number;
  tryBonus: number;
  losingBonus: number;
  points: number;
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error(`ESPN ${res.status} for ${url}`);
  const body = (await res.json()) as T & { code?: number; message?: string };
  if (body.code && body.code >= 400) throw new Error(`ESPN ${body.code}: ${body.message} (${url})`);
  return body;
}

function team(c: FeedCompetitor): TeamRef {
  return {
    id: c.team.id,
    name: c.team.displayName,
    short: c.team.abbreviation ?? c.team.displayName.slice(0, 3).toUpperCase(),
  };
}

function status(e: FeedEvent): { status: FixtureStatus; clock: string | null } {
  const s = e.competitions[0].status;
  if (s.type.state === "in") {
    return { status: "live", clock: s.type.name === "STATUS_HALFTIME" ? "HT" : (s.displayClock ?? null) };
  }
  // Postponed or abandoned games come back as "post" but not completed;
  // they stay on the fixture list rather than appearing as results.
  if (s.type.state === "post" && s.type.completed) return { status: "result", clock: null };
  return { status: "scheduled", clock: null };
}

export function mapEvent(e: FeedEvent): MappedEvent | null {
  const comp = e.competitions[0];
  const home = comp?.competitors.find((c) => c.homeAway === "home");
  const away = comp?.competitors.find((c) => c.homeAway === "away");
  if (!comp || !home || !away) return null;

  const { venue, known } = resolveVenue(comp.venue);
  const st = status(e);
  const hasScore = st.status !== "scheduled";

  return {
    feedId: e.id,
    kickoff: new Date(e.date),
    venue,
    venueKnown: known,
    home: team(home),
    away: team(away),
    ...st,
    // The feed carries no try counts, so tries stay null.
    score: hasScore
      ? { home: Number(home.score ?? 0), away: Number(away.score ?? 0), homeTries: null, awayTries: null }
      : null,
  };
}

/** A whole season (dates=YYYY). The feed rejects date ranges. */
export async function fetchSeason(league: string, season: string): Promise<MappedEvent[]> {
  const body = await getJson<{ events?: FeedEvent[] }>(
    `${BASE}/site/v2/sports/rugby/${league}/scoreboard?dates=${season}&limit=500`,
  );
  return (body.events ?? []).map(mapEvent).filter((e): e is MappedEvent => e !== null);
}

/** Whatever the feed considers "current": today's games, or the next ones. */
export async function fetchCurrent(league: string): Promise<MappedEvent[]> {
  const body = await getJson<{ events?: FeedEvent[] }>(`${BASE}/site/v2/sports/rugby/${league}/scoreboard`);
  return (body.events ?? []).map(mapEvent).filter((e): e is MappedEvent => e !== null);
}

export async function fetchStandings(league: string, season: string): Promise<OfficialStanding[]> {
  const body = await getJson<{
    children?: { standings?: { entries?: FeedStandingsEntry[] } }[];
  }>(`${BASE}/v2/sports/rugby/${league}/standings?season=${season}`);

  const entries = body.children?.flatMap((c) => c.standings?.entries ?? []) ?? [];
  return entries.map((e) => {
    const stat = (name: string) => Number(e.stats.find((s) => s.name === name)?.value ?? 0);
    return {
      teamId: e.team.id,
      name: e.team.displayName,
      rank: stat("rank"),
      played: stat("gamesPlayed"),
      won: stat("gamesWon"),
      drawn: stat("gamesDrawn"),
      lost: stat("gamesLost"),
      pointsFor: stat("pointsFor"),
      pointsAgainst: stat("pointsAgainst"),
      triesFor: stat("triesFor"),
      tryBonus: stat("bonusPointsTry"),
      losingBonus: stat("bonusPointsLosing"),
      points: stat("points"),
    };
  });
}
