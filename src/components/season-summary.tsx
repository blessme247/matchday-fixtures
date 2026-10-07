import type { Fixture } from "@/lib/types";
import type { FormResult } from "./ladder";

/** One team's season, derived from its results. */
export function TeamRecord({ team, season, fixtures }: { team: string; season: string; fixtures: Fixture[] }) {
  const results = fixtures.filter((f) => f.status === "result" && f.score);
  let won = 0, drawn = 0, lost = 0, pointsFor = 0, pointsAgainst = 0;
  const form: FormResult[] = [];
  for (const f of results) {
    const home = f.home.name === team;
    const us = home ? f.score!.home : f.score!.away;
    const them = home ? f.score!.away : f.score!.home;
    pointsFor += us;
    pointsAgainst += them;
    const r: FormResult = us > them ? "W" : us < them ? "L" : "D";
    form.push(r);
    if (r === "W") won++;
    else if (r === "D") drawn++;
    else lost++;
  }
  const remaining = fixtures.filter((f) => f.status !== "result").length;

  return (
    <section aria-labelledby="record-heading" className="border-t border-rule pt-5">
      <h2 id="record-heading" className="font-display text-[1.375rem] font-semibold tracking-[-0.01em]">
        {season} record
      </h2>
      <p className="mt-1 text-[0.8125rem] text-ink-3">
        {results.length} played · {remaining} to come
      </p>

      <dl className="mt-5 grid grid-cols-3 border-y border-rule-soft">
        <Stat label="Won" value={won} />
        <Stat label="Drawn" value={drawn} />
        <Stat label="Lost" value={lost} />
      </dl>

      <dl className="mt-4 grid grid-cols-2 gap-y-3 text-[0.8125rem]">
        <dt className="text-ink-3">Points for</dt>
        <dd className="text-right font-mono tabular-nums">{pointsFor}</dd>
        <dt className="text-ink-3">Points against</dt>
        <dd className="text-right font-mono tabular-nums">{pointsAgainst}</dd>
        <dt className="text-ink-3">Difference</dt>
        <dd className="text-right font-mono tabular-nums">
          {pointsFor - pointsAgainst > 0 ? "+" : ""}
          {pointsFor - pointsAgainst}
        </dd>
      </dl>

      {form.length > 0 && (
        <div className="mt-5">
          <p className="label mb-2">Form, oldest first</p>
          <p className="flex gap-1.5" role="img" aria-label={`Form: ${form.join(" ")}`}>
            {form.map((r, i) => (
              <span
                key={i}
                className={`grid size-7 place-items-center border font-mono text-xs ${
                  r === "W"
                    ? "border-green bg-green text-background"
                    : r === "D"
                      ? "border-gold bg-gold text-ink"
                      : "border-ink-3 text-ink-2"
                }`}
              >
                {r}
              </span>
            ))}
          </p>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col-reverse py-4 text-center">
      <dt className="label mt-1">{label}</dt>
      <dd className="font-mono text-4xl font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/** Where a tournament is played, with the zone each venue keeps. */
export function HostVenues({ fixtures, zoneLabel }: { fixtures: Fixture[]; zoneLabel: (f: Fixture) => string }) {
  // Zones per venue in kick-off order, so a daylight-saving change mid-event
  // shows up as "ACST → ACDT".
  const venues = new Map<string, { fixture: Fixture; count: number; zones: string[] }>();
  for (const f of fixtures) {
    const zone = zoneLabel(f);
    const v = venues.get(f.venue.name);
    if (!v) venues.set(f.venue.name, { fixture: f, count: 1, zones: [zone] });
    else {
      v.count++;
      if (!v.zones.includes(zone)) v.zones.push(zone);
    }
  }
  const dstChange = [...venues.values()].some((v) => v.zones.length > 1);
  const teams = new Set(fixtures.flatMap((f) => [f.home.id, f.away.id])).size;
  const sorted = [...venues.values()].sort((a, b) => b.count - a.count);

  return (
    <section aria-labelledby="venues-heading" className="border-t border-rule pt-5">
      <h2 id="venues-heading" className="font-display text-[1.375rem] font-semibold tracking-[-0.01em]">
        Host venues
      </h2>
      <p className="mt-1 text-[0.8125rem] text-ink-3">
        {fixtures.length} matches · {teams} teams · {venues.size} venues
      </p>
      <ul className="mt-4">
        {sorted.map(({ fixture: f, count, zones }) => (
          <li key={f.venue.name} className="flex items-baseline justify-between gap-3 border-b border-rule-soft py-3 last:border-0">
            <span className="min-w-0">
              <span className="block truncate text-[0.875rem] font-semibold">{f.venue.name}</span>
              <span className="text-xs text-ink-3">
                {f.venue.city} · {zones.join(" → ")}
              </span>
            </span>
            <span className="shrink-0 font-mono text-sm tabular-nums">
              {count} <span className="text-ink-3">{count === 1 ? "match" : "matches"}</span>
            </span>
          </li>
        ))}
      </ul>
      {dstChange && (
        <p className="mt-3 text-xs text-ink-3">
          Daylight saving starts during the tournament in some host states, not others. Every kick-off is
          labelled with the zone in force on the day.
        </p>
      )}
    </section>
  );
}
