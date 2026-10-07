import { cacheLife, cacheTag } from "next/cache";
import { getDb, fixturesCollection } from "./db";
import { fixturesTag, type CompetitionId } from "./competitions";
import { ladderPipeline } from "./ladder-pipeline";
import type { CompetitionMeta, CompetitionMetaDoc, Fixture, FixtureDoc, LadderRow } from "./types";

// Fixtures change when results land or the schedule moves. The sync and the
// live endpoint both revalidate on change, so this lifetime is a safety net.
const fixturesLife = { stale: 300, revalidate: 900, expire: 86_400 };

function toFixture(doc: FixtureDoc): Fixture {
  const { _id, kickoff, updatedAt, ...rest } = doc;
  void updatedAt; // internal bookkeeping, not sent to the client
  return { ...rest, id: _id, kickoff: kickoff.toISOString() };
}

export async function getFixtures(competitionId: CompetitionId): Promise<Fixture[]> {
  "use cache";
  cacheLife(fixturesLife);
  cacheTag("fixtures", fixturesTag(competitionId));

  const fixtures = await fixturesCollection();
  const docs = await fixtures.find({ competitionId }).sort({ kickoff: 1 }).toArray();
  return docs.map(toFixture);
}

export async function getLadder(competitionId: CompetitionId): Promise<LadderRow[]> {
  "use cache";
  cacheLife(fixturesLife);
  cacheTag("fixtures", fixturesTag(competitionId));

  const fixtures = await fixturesCollection();
  return fixtures.aggregate<LadderRow>(ladderPipeline(competitionId)).toArray();
}

export async function getCompetitionMeta(competitionId: CompetitionId): Promise<CompetitionMeta | null> {
  "use cache";
  cacheLife(fixturesLife);
  cacheTag("fixtures", fixturesTag(competitionId));

  const doc = await (await getDb())
    .collection<CompetitionMetaDoc>("competition_meta")
    .findOne({ _id: competitionId });
  if (!doc) return null;
  const { _id, syncedAt, ...rest } = doc;
  void _id;
  return { ...rest, syncedAt: syncedAt.toISOString() };
}
