export type TeamRef = {
  id: string;
  name: string;
  short: string;
};

export type Venue = {
  name: string;
  city: string;
  country: string;
  /** IANA zone, e.g. "Australia/Brisbane". Kick-offs render in venue time. */
  timeZone: string;
};

export type FixtureStatus = "scheduled" | "live" | "result";

export type Score = {
  home: number;
  away: number;
  /** Null when the source has no try counts (the ESPN feed doesn't). */
  homeTries: number | null;
  awayTries: number | null;
};

/** Shape stored in MongoDB (`fixtures` collection). */
export type FixtureDoc = {
  _id: string;
  competitionId: string;
  round: string;
  stage: "regular" | "finals";
  kickoff: Date;
  venue: Venue;
  home: TeamRef;
  away: TeamRef;
  status: FixtureStatus;
  score: Score | null;
  /** Match clock while live, e.g. "54'" or "HT". */
  clock: string | null;
  updatedAt: Date;
};

/** Serialisable shape passed to components (kickoff as ISO string). */
export type Fixture = Omit<FixtureDoc, "_id" | "kickoff" | "updatedAt"> & {
  id: string;
  kickoff: string;
};

export type LiveUpdate = Pick<Fixture, "id" | "status" | "score" | "clock">;

export type LadderRow = {
  teamId: string;
  name: string;
  short: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDiff: number;
  triesFor: number;
  losingBonus: number;
  tryBonus: number;
  bonus: number;
  competitionPoints: number;
};

/** Official table from the feed (`standings` collection), used for try bonus
 *  points and to reconcile the computed ladder. */
export type StandingDoc = {
  _id: string;
  competitionId: string;
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
  syncedAt: Date;
};

export type Mismatch = { team: string; field: string; ours: number; official: number };

/** Per-competition sync bookkeeping (`competition_meta` collection). */
export type CompetitionMetaDoc = {
  _id: string;
  syncedAt: Date;
  fixtures: number;
  unknownVenues: string[];
  reconciliation: { teams: number; matched: number; mismatches: Mismatch[] } | null;
};

export type CompetitionMeta = Omit<CompetitionMetaDoc, "_id" | "syncedAt"> & { syncedAt: string };
