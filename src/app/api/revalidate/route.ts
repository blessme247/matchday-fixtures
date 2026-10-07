import { revalidateTag } from "next/cache";
import { authorised } from "@/lib/auth";
import { fixturesTag, isCompetitionId } from "@/lib/competitions";

/**
 * Webhook for whatever publishes results (CMS, data feed, admin tool).
 * The sync calls this after a CLI run; the sync route revalidates directly.
 * Body: { "competition": "wallabies" } or {} to refresh everything.
 *
 * Uses the "max" profile: the next visitor gets the cached page instantly and
 * triggers the rebuild, instead of every visitor waiting on the database the
 * moment a result lands. Live scores cover the seconds in between.
 */
export async function POST(request: Request) {
  if (!authorised(request.headers.get("authorization"))) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => ({}));
  const competition =
    body && typeof body === "object" && "competition" in body ? body.competition : undefined;

  if (competition !== undefined && !isCompetitionId(competition)) {
    return Response.json({ error: "Unknown competition" }, { status: 400 });
  }

  const tag = competition ? fixturesTag(competition) : "fixtures";
  revalidateTag(tag, "max");
  return Response.json({ revalidated: tag });
}
