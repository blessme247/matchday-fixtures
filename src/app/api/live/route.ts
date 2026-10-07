import type { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { fixturesTag, getCompetition } from "@/lib/competitions";
import { fetchCurrent } from "@/lib/espn";
import { applyLiveEvents, fixtureId } from "@/lib/sync";
import type { LiveUpdate } from "@/lib/types";

/**
 * Live scores for open tabs. On match day thousands of clients poll this, so
 * the CDN absorbs the burst: each region calls the function (and the feed)
 * at most once every 10 seconds per competition, and serves the previous
 * response while it refreshes.
 *
 * It also writes changes through to MongoDB, and revalidates the cached page
 * when a match changes state (kick-off, full time), so the page catches up
 * without waiting for the scheduled sync.
 */
export async function GET(request: NextRequest) {
  const competition = getCompetition(request.nextUrl.searchParams.get("competition") ?? "");
  if (!competition) {
    return Response.json({ error: "Unknown competition" }, { status: 400 });
  }

  try {
    const team = "team" in competition.feed ? competition.feed.team : undefined;
    const events = (await fetchCurrent(competition.feed.league)).filter(
      (e) => !team || e.home.name === team || e.away.name === team,
    );

    const { stateChanged } = await applyLiveEvents(competition, events);
    if (stateChanged) revalidateTag(fixturesTag(competition.id), "max");

    const fixtures: LiveUpdate[] = events
      .filter((e) => e.status !== "scheduled")
      .map((e) => ({ id: fixtureId(e.feedId), status: e.status, score: e.score, clock: e.clock }));

    return Response.json(
      { fixtures, generatedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "public, max-age=0, s-maxage=10, stale-while-revalidate=20" } },
    );
  } catch (err) {
    console.error("live feed failed", err);
    // Short CDN cache so a feed outage doesn't hammer it, but recovers fast.
    return Response.json(
      { error: "Live feed unavailable" },
      { status: 502, headers: { "Cache-Control": "public, max-age=0, s-maxage=5" } },
    );
  }
}
