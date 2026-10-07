import type { Document } from "mongodb";

/**
 * Builds the competition ladder from completed regular-season fixtures in a
 * single aggregation, so the table can never drift from the results.
 *
 * Points: win 4, draw 2, plus one bonus point for losing by 7 or fewer
 * (computed here from the scores) and try bonus points. The feed carries no
 * try counts per match, so try bonus points and tries scored are joined in
 * from the official table (`standings`). Every other column is derived from
 * results, and the sync reconciles all of them against the official table.
 */
export function ladderPipeline(competitionId: string): Document[] {
  return [
    { $match: { competitionId, stage: "regular", status: "result" } },

    // One fixture -> two rows, one from each team's point of view.
    {
      $project: {
        _id: 0,
        rows: [
          { team: "$home", for: "$score.home", against: "$score.away" },
          { team: "$away", for: "$score.away", against: "$score.home" },
        ],
      },
    },
    { $unwind: "$rows" },
    { $replaceWith: "$rows" },

    {
      $set: {
        won: { $cond: [{ $gt: ["$for", "$against"] }, 1, 0] },
        drawn: { $cond: [{ $eq: ["$for", "$against"] }, 1, 0] },
        lost: { $cond: [{ $lt: ["$for", "$against"] }, 1, 0] },
        losingBonus: {
          $cond: [
            {
              $and: [
                { $lt: ["$for", "$against"] },
                { $lte: [{ $subtract: ["$against", "$for"] }, 7] },
              ],
            },
            1,
            0,
          ],
        },
      },
    },

    {
      $group: {
        _id: "$team.id",
        name: { $first: "$team.name" },
        short: { $first: "$team.short" },
        played: { $sum: 1 },
        won: { $sum: "$won" },
        drawn: { $sum: "$drawn" },
        lost: { $sum: "$lost" },
        pointsFor: { $sum: "$for" },
        pointsAgainst: { $sum: "$against" },
        losingBonus: { $sum: "$losingBonus" },
      },
    },

    {
      $lookup: {
        from: "standings",
        let: { teamId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$competitionId", competitionId] }, { $eq: ["$teamId", "$$teamId"] }],
              },
            },
          },
          { $project: { _id: 0, tryBonus: 1, triesFor: 1 } },
        ],
        as: "official",
      },
    },
    {
      $set: {
        tryBonus: { $ifNull: [{ $first: "$official.tryBonus" }, 0] },
        triesFor: { $ifNull: [{ $first: "$official.triesFor" }, 0] },
      },
    },

    {
      $set: {
        pointsDiff: { $subtract: ["$pointsFor", "$pointsAgainst"] },
        bonus: { $add: ["$losingBonus", "$tryBonus"] },
        competitionPoints: {
          $add: [{ $multiply: ["$won", 4] }, { $multiply: ["$drawn", 2] }, "$losingBonus", "$tryBonus"],
        },
      },
    },

    // Tie-breakers: competition points, wins, points difference, tries.
    { $sort: { competitionPoints: -1, won: -1, pointsDiff: -1, triesFor: -1, _id: 1 } },
    { $set: { teamId: "$_id" } },
    { $unset: ["_id", "official"] },
  ];
}
