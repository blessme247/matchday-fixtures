import type { CompetitionMeta, LadderRow } from "@/lib/types";

export type FormResult = "W" | "D" | "L";

const formWord = { W: "won", D: "drew", L: "lost" } as const;

export function Ladder({
  rows,
  form,
  reconciliation,
}: {
  rows: LadderRow[];
  form: Record<string, FormResult[]>;
  reconciliation: CompetitionMeta["reconciliation"];
}) {
  return (
    <section aria-labelledby="ladder-heading" className="border-t border-rule pt-5 lg:mt-0">
      <h2 id="ladder-heading" className="font-display text-[1.375rem] font-semibold tracking-[-0.01em]">
        Ladder
      </h2>
      <p className="mt-1 text-[0.8125rem] text-ink-3">
        Regular season. One MongoDB aggregation over the results.
      </p>
      {reconciliation && <Reconciliation {...reconciliation} />}

      {rows.length === 0 ? (
        <p className="text-ink-2">No results yet.</p>
      ) : (
        <table className="w-full text-[0.8125rem]">
          <caption className="sr-only">
            Competition ladder: played, won, lost, points difference, bonus points, competition points, recent form
          </caption>
          <thead>
            <tr className="label border-b border-rule text-left [&>th]:pb-2 [&>th]:font-normal">
              <th scope="col" className="w-6">#</th>
              <th scope="col">Team</th>
              <Num as="th"><abbr title="Played">P</abbr></Num>
              <Num as="th"><abbr title="Won">W</abbr></Num>
              <Num as="th"><abbr title="Lost">L</abbr></Num>
              <Num as="th"><abbr title="Points difference">PD</abbr></Num>
              <Num as="th"><abbr title="Bonus points">BP</abbr></Num>
              <Num as="th"><abbr title="Competition points">Pts</abbr></Num>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.teamId} className="border-b border-rule-soft last:border-0 [&>td]:py-3 [&>th]:py-3">
                <td className={`font-mono tabular-nums ${i === 0 ? "text-green font-medium" : "text-ink-3"}`}>
                  {i + 1}
                </td>
                <th scope="row" className="pr-2 text-left font-normal">
                  <span className="block font-semibold">{r.name}</span>
                  <Form results={form[r.teamId] ?? []} />
                </th>
                <Num>{r.played}</Num>
                <Num>{r.won}</Num>
                <Num>{r.lost}</Num>
                <Num>{r.pointsDiff > 0 ? `+${r.pointsDiff}` : r.pointsDiff}</Num>
                <Num>{r.bonus}</Num>
                <Num strong>{r.competitionPoints}</Num>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3" aria-hidden="true">
        <span className="flex items-center gap-1.5"><FormMark result="W" /> Won</span>
        <span className="flex items-center gap-1.5"><FormMark result="D" /> Drew</span>
        <span className="flex items-center gap-1.5"><FormMark result="L" /> Lost</span>
        <span>Win 4 · draw 2 · bonus point for losing by ≤7 · try bonus from the official table</span>
      </p>
    </section>
  );
}

/** Result of the sync's audit: our computed ladder vs the official table. */
function Reconciliation({ teams, matched, mismatches }: NonNullable<CompetitionMeta["reconciliation"]>) {
  const clean = teams > 0 && matched === teams && mismatches.length === 0;
  return (
    <div className="mt-3 mb-4">
      <span className={`pill pill--static ${clean ? "pill--selected" : "pill--live"}`}>
        {clean ? "✓ " : ""}
        {matched}/{teams} teams match ESPN&rsquo;s table
      </span>
      {!clean && mismatches.length > 0 && (
        <ul className="mt-2 text-xs text-ink-2">
          {mismatches.slice(0, 5).map((m) => (
            <li key={`${m.team}-${m.field}`}>
              {m.team}: {m.field} {m.ours} vs {m.official}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Num({
  children,
  strong = false,
  as: Tag = "td",
}: {
  children: React.ReactNode;
  strong?: boolean;
  as?: "td" | "th";
}) {
  return (
    <Tag
      {...(Tag === "th" ? { scope: "col" } : {})}
      className={`pl-2 text-right font-mono tabular-nums ${strong ? "text-sm font-medium text-ink" : ""}`}
    >
      {children}
    </Tag>
  );
}

function Form({ results }: { results: FormResult[] }) {
  if (results.length === 0) return null;
  return (
    <span
      className="mt-1.5 flex gap-1"
      role="img"
      aria-label={`Form, oldest first: ${results.map((r) => formWord[r]).join(", ")}`}
    >
      {results.map((r, i) => (
        <FormMark key={i} result={r} />
      ))}
    </span>
  );
}

function FormMark({ result }: { result: FormResult }) {
  const style =
    result === "W" ? "bg-green border-green" : result === "D" ? "bg-gold border-gold" : "border-ink-3";
  return <span className={`inline-block size-2 border ${style}`} />;
}
