import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Ladder, type FormResult } from "@/components/ladder";
import { MatchCentre, type DisplayFixture } from "@/components/match-centre";
import { HostVenues, TeamRecord } from "@/components/season-summary";
import { competitions, getCompetition } from "@/lib/competitions";
import { getCompetitionMeta, getFixtures, getLadder } from "@/lib/data";
import { formatKickoff, venueDateKey } from "@/lib/format";
import type { Fixture } from "@/lib/types";

export function generateStaticParams() {
  return competitions.map((c) => ({ competition: c.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/fixtures/[competition]">): Promise<Metadata> {
  const competition = getCompetition((await params).competition);
  return { title: competition ? `${competition.name} fixtures and results` : "Fixtures" };
}

/** Last five results per team, oldest first. Fixtures arrive in kick-off order. */
function recentForm(fixtures: Fixture[]): Record<string, FormResult[]> {
  const form: Record<string, FormResult[]> = {};
  const push = (id: string, r: FormResult) => (form[id] = [...(form[id] ?? []), r].slice(-5));
  for (const f of fixtures) {
    if (f.status !== "result" || !f.score || f.stage !== "regular") continue;
    const { home, away } = f.score;
    push(f.home.id, home > away ? "W" : home < away ? "L" : "D");
    push(f.away.id, away > home ? "W" : away < home ? "L" : "D");
  }
  return form;
}

function formatSynced(iso: string) {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

export default async function FixturesPage({ params }: PageProps<"/fixtures/[competition]">) {
  const competition = getCompetition((await params).competition);
  if (!competition) notFound();

  const [fixtures, ladder, meta] = await Promise.all([
    getFixtures(competition.id),
    competition.hasLadder ? getLadder(competition.id) : Promise.resolve(null),
    getCompetitionMeta(competition.id),
  ]);

  const focusTeam = "team" in competition.feed ? competition.feed.team : undefined;

  // Formatting happens here, on the server, so every visitor gets the same
  // HTML and the client never re-derives it (no hydration mismatch, no flash).
  const display: DisplayFixture[] = fixtures.map((f) => ({
    ...f,
    display: formatKickoff(f.kickoff, f.venue.timeZone),
    dateKey: venueDateKey(f.kickoff, f.venue.timeZone),
  }));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 pt-8">
        <h1 className="font-display text-[clamp(2rem,4vw,3rem)] font-semibold leading-none tracking-[-0.02em]">
          {competition.name}
        </h1>
        <nav aria-label="Competitions">
          <ul className="flex flex-wrap gap-2">
            {competitions.map((c) => {
              const current = c.id === competition.id;
              return (
                <li key={c.id}>
                  <Link
                    href={`/fixtures/${c.id}`}
                    aria-current={current ? "page" : undefined}
                    className={`pill ${current ? "pill--selected" : ""}`}
                  >
                    {c.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <MatchCentre
        competitionId={competition.id}
        fixtures={display}
        focusTeam={focusTeam}
        aside={
          ladder ? (
            <Ladder rows={ladder} form={recentForm(fixtures)} reconciliation={meta?.reconciliation ?? null} />
          ) : focusTeam ? (
            <TeamRecord team={focusTeam} season={competition.feed.season} fixtures={fixtures} />
          ) : (
            <HostVenues fixtures={fixtures} zoneLabel={(f) => formatKickoff(f.kickoff, f.venue.timeZone).zone} />
          )
        }
      />

      <footer className="mt-8 border-t border-rule pt-5 text-xs leading-relaxed text-ink-3">
        <p>
          Fixtures and scores: ESPN&rsquo;s public scoreboard feed (unofficial, not affiliated). Kick-offs in
          venue time; some feed venues are corrected in code.
          {meta && <> Last synced {formatSynced(meta.syncedAt)}.</>}
        </p>
        <p className="mt-1">A prototype. Not affiliated with Rugby Australia, Super Rugby or World Rugby.</p>
      </footer>
    </>
  );
}
