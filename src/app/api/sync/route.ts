import { revalidateTag } from "next/cache";
import { authorised } from "@/lib/auth";
import { competitions, fixturesTag, isCompetitionId } from "@/lib/competitions";
import { ensureIndexes, syncCompetition, type SyncReport } from "@/lib/sync";

/**
 * Scheduled sync (GitHub Actions calls this; see .github/workflows/sync.yml).
 * Body: { "competition": "wallabies" } or {} for all.
 */
export async function POST(request: Request) {
  if (!authorised(request.headers.get("authorization"))) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => ({}));
  const requested =
    body && typeof body === "object" && "competition" in body ? body.competition : undefined;
  if (requested !== undefined && !isCompetitionId(requested)) {
    return Response.json({ error: "Unknown competition" }, { status: 400 });
  }

  await ensureIndexes();
  const reports: (SyncReport | { competition: string; error: string })[] = [];
  for (const c of competitions.filter((c) => !requested || c.id === requested)) {
    try {
      reports.push(await syncCompetition(c));
      revalidateTag(fixturesTag(c.id), "max");
    } catch (err) {
      // One competition failing shouldn't stop the others.
      reports.push({ competition: c.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  const failed = reports.some((r) => "error" in r);
  return Response.json({ reports }, { status: failed ? 502 : 200 });
}
