// Competitions are configuration, not content: they decide which routes get
// prerendered and what gets synced, so they live in code.
export const competitions = [
  {
    id: "wallabies",
    name: "Wallabies",
    hasLadder: false,
    feed: { league: "289234", season: "2026", team: "Australia" },
  },
  {
    id: "super-rugby-pacific",
    name: "Super Rugby Pacific",
    hasLadder: true,
    feed: { league: "242041", season: "2026" },
  },
  {
    id: "rugby-world-cup-2027",
    name: "Rugby World Cup 2027",
    hasLadder: false,
    feed: { league: "164205", season: "2027" },
  },
] as const;

export type Competition = (typeof competitions)[number];
export type CompetitionId = Competition["id"];

export const defaultCompetitionId: CompetitionId = "wallabies";

export function getCompetition(id: string): Competition | undefined {
  return competitions.find((c) => c.id === id);
}

export function isCompetitionId(id: unknown): id is CompetitionId {
  return typeof id === "string" && getCompetition(id) !== undefined;
}

export const fixturesTag = (id: CompetitionId) => `fixtures:${id}`;
