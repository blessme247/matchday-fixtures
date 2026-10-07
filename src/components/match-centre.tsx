"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { FormattedKickoff } from "@/lib/format";
import type { Fixture, LiveUpdate } from "@/lib/types";
import { LocalTime } from "./local-time";

export type DisplayFixture = Fixture & {
  display: FormattedKickoff;
  dateKey: string;
};

const POLL_MS = 15_000;
// Start polling shortly before the first kick-off and stop once nothing can
// still be in play.
const WINDOW_BEFORE_MS = 30 * 60 * 1000;
const WINDOW_AFTER_MS = 3 * 60 * 60 * 1000;

function useLiveUpdates(competitionId: string, fixtures: DisplayFixture[]) {
  const [updates, setUpdates] = useState<Record<string, LiveUpdate>>({});

  useEffect(() => {
    const now = Date.now();
    const inPlayWindow = fixtures.some((f) => {
      if (f.status === "live") return true;
      if (f.status !== "scheduled") return false;
      const kickoff = Date.parse(f.kickoff);
      return now >= kickoff - WINDOW_BEFORE_MS && now <= kickoff + WINDOW_AFTER_MS;
    });
    if (!inPlayWindow) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/live?competition=${competitionId}`);
        if (!res.ok) return;
        const { fixtures: live }: { fixtures: LiveUpdate[] } = await res.json();
        if (!cancelled) setUpdates(Object.fromEntries(live.map((u) => [u.id, u])));
      } catch {
        // Offline or a blip: keep showing the last known scores.
      }
    };

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [competitionId, fixtures]);

  return updates;
}

export function MatchCentre({
  competitionId,
  fixtures,
  aside,
  focusTeam,
}: {
  competitionId: string;
  fixtures: DisplayFixture[];
  aside?: ReactNode;
  /** A competition built around one team: filter by opponent instead. */
  focusTeam?: string;
}) {
  const [team, setTeam] = useState("all");
  const updates = useLiveUpdates(competitionId, fixtures);

  const teams = useMemo(() => {
    const byId = new Map<string, string>();
    for (const f of fixtures) {
      byId.set(f.home.id, f.home.name);
      byId.set(f.away.id, f.away.name);
    }
    return [...byId].filter(([, name]) => name !== focusTeam).sort((a, b) => a[1].localeCompare(b[1]));
  }, [fixtures, focusTeam]);

  const merged = fixtures
    .map((f) => ({ ...f, ...updates[f.id] }))
    .filter((f) => team === "all" || f.home.id === team || f.away.id === team);

  const upcoming = merged.filter((f) => f.status !== "result");
  const results = merged.filter((f) => f.status === "result").reverse();
  const featured = upcoming.find((f) => f.status === "live") ?? upcoming[0] ?? results[0];

  return (
    <>
      {featured && <Hero fixture={featured} />}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-14 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <div
            role="group"
            aria-label={focusTeam ? "Filter by opponent" : "Filter by team"}
            className="scroll-row -mx-5 flex gap-2 overflow-x-auto border-t border-rule px-5 py-5 md:mx-0 md:px-0"
          >
            <TeamPill selected={team === "all"} onClick={() => setTeam("all")}>
              {focusTeam ? "All opponents" : "All teams"}
            </TeamPill>
            {teams.map(([id, name]) => (
              <TeamPill key={id} selected={team === id} onClick={() => setTeam(id)}>
                {name}
              </TeamPill>
            ))}
          </div>

          {upcoming.length > 0 && <FixtureGroup title="Live and upcoming" fixtures={upcoming} />}
          <FixtureGroup title="Results" fixtures={results} empty="No results yet." pageSize={12} />
        </div>

        {aside && <aside className="lg:sticky lg:top-6 lg:self-start">{aside}</aside>}
      </div>
    </>
  );
}

function TeamPill({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`pill shrink-0 ${selected ? "pill--selected" : ""}`}
    >
      {children}
    </button>
  );
}

/** The match that matters right now: live if there is one, otherwise next up. */
function Hero({ fixture: f }: { fixture: DisplayFixture }) {
  const live = f.status === "live" && f.score;
  const final = f.status === "result" && f.score;
  const showScore = live || final;

  return (
    <section aria-labelledby="hero-heading" className="py-10 md:py-14">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {live ? (
          <span className="pill pill--static pill--live">
            <span className="live-dot" aria-hidden="true" />
            Live{f.clock ? ` · ${f.clock}` : ""}
          </span>
        ) : final ? (
          <span className="label">Latest result · Full time</span>
        ) : (
          <span className="label">Next up</span>
        )}
        <span className="label">{f.round}</span>
      </div>

      <h2 id="hero-heading" className="sr-only">
        {showScore
          ? `${live ? "Live" : "Full time"}: ${f.home.name} ${f.score!.home}, ${f.away.name} ${f.score!.away}`
          : `Next up: ${f.home.name} versus ${f.away.name}`}
      </h2>

      <div
        aria-hidden="true"
        className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 md:gap-10"
      >
        <p className="text-right font-display text-[clamp(1.75rem,5.2vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.02em]">
          {f.home.name}
        </p>
        {showScore ? (
          <p className="font-mono text-[clamp(2.5rem,8vw,7rem)] font-medium leading-none tracking-[-0.03em] tabular-nums">
            <Score value={f.score!.home} />
            <span className="mx-[0.12em] text-ink-3">–</span>
            <Score value={f.score!.away} />
          </p>
        ) : (
          <p className="font-display text-[clamp(1.25rem,2.6vw,2.25rem)] italic leading-none text-ink-3">v</p>
        )}
        <p className="font-display text-[clamp(1.75rem,5.2vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.02em]">
          {f.away.name}
        </p>
      </div>

      <div className="mt-8 flex flex-wrap items-baseline justify-center gap-x-6 gap-y-1 text-center">
        {!showScore && (
          <p className="font-mono text-2xl font-medium tabular-nums">
            <time dateTime={f.kickoff}>{f.display.time}</time>{" "}
            <span className="text-base text-ink-2">{f.display.zone}</span>
          </p>
        )}
        <p className="text-ink-2">
          {f.display.day} · {venueLabel(f)}
        </p>
      </div>
      {!showScore && (
        <div className="mt-1 text-center">
          <LocalTime iso={f.kickoff} venueTimeZone={f.venue.timeZone} />
        </div>
      )}
    </section>
  );
}

function FixtureGroup({
  title,
  fixtures,
  empty,
  pageSize,
}: {
  title: string;
  fixtures: DisplayFixture[];
  empty?: string;
  pageSize?: number;
}) {
  const [limit, setLimit] = useState(pageSize ?? Infinity);
  const visible = fixtures.slice(0, limit);
  const hidden = fixtures.length - visible.length;

  const byDate = new Map<string, DisplayFixture[]>();
  for (const f of visible) {
    const group = byDate.get(f.dateKey) ?? [];
    group.push(f);
    byDate.set(f.dateKey, group);
  }

  return (
    <section className="mt-6 mb-12" aria-label={title}>
      <h2 className="mb-2 font-display text-[1.375rem] font-semibold tracking-[-0.01em]">{title}</h2>
      {fixtures.length === 0 && empty && <p className="py-4 text-ink-2">{empty}</p>}
      {[...byDate].map(([key, group]) => (
        <div key={key} className="mt-6">
          <h3 className="label border-b border-rule pb-2">{group[0].display.day}</h3>
          <ul>
            {group.map((f) => (
              <li key={f.id} className="border-b border-rule-soft last:border-0">
                <FixtureRow fixture={f} />
              </li>
            ))}
          </ul>
        </div>
      ))}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + (pageSize ?? hidden))}
          className="pill mt-6"
        >
          Show earlier results <span className="font-mono text-ink-3">{hidden}</span>
        </button>
      )}
    </section>
  );
}

function FixtureRow({ fixture: f }: { fixture: DisplayFixture }) {
  const hasScore = f.score !== null && f.status !== "scheduled";
  const homeWon = hasScore && f.status === "result" && f.score!.home > f.score!.away;
  const awayWon = hasScore && f.status === "result" && f.score!.away > f.score!.home;
  const label = hasScore
    ? `${f.home.name} ${f.score!.home}, ${f.away.name} ${f.score!.away}${f.status === "live" ? ", live" : ", full time"}`
    : `${f.home.name} versus ${f.away.name}, ${f.display.time} ${f.display.zone}`;

  return (
    <article aria-label={label} className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-x-4 py-4 md:grid-cols-[6rem_minmax(0,1fr)_auto]">
      {/* Time column: venue time, zone underneath. Results show FT. */}
      <div className="pt-0.5">
        {f.status === "result" ? (
          <span className="font-mono text-sm font-medium">FT</span>
        ) : (
          <>
            <time dateTime={f.kickoff} className="block font-mono text-sm font-medium tabular-nums">
              {f.display.time}
            </time>
            <span className="label">{f.display.zone}</span>
          </>
        )}
      </div>

      <div className="min-w-0">
        {/* Fixed-width score column: a score arriving never moves anything. */}
        <div aria-hidden="true" className="grid grid-cols-[minmax(0,1fr)_2.5rem] gap-y-1 text-[0.9375rem]">
          <TeamLine name={f.home.name} strong={!hasScore || homeWon || f.status === "live"} />
          <ScoreCell value={hasScore ? f.score!.home : null} strong={homeWon} />
          <TeamLine name={f.away.name} strong={!hasScore || awayWon || f.status === "live"} />
          <ScoreCell value={hasScore ? f.score!.away : null} strong={awayWon} />
        </div>
        <p className="mt-2 text-[0.8125rem] text-ink-3">
          {venueLabel(f)}
        </p>
        {f.status === "scheduled" && <LocalTime iso={f.kickoff} venueTimeZone={f.venue.timeZone} />}
      </div>

      {f.status === "live" && (
        <div className="col-start-2 mt-2 md:col-start-3 md:mt-0">
          <span className="pill pill--static pill--live">
            <span className="live-dot" aria-hidden="true" />
            Live{f.clock ? ` · ${f.clock}` : ""}
          </span>
        </div>
      )}
    </article>
  );
}

function venueLabel(f: DisplayFixture) {
  const place = f.venue.city || f.venue.country;
  return place ? `${f.venue.name}, ${place}` : f.venue.name;
}

function TeamLine({ name, strong }: { name: string; strong: boolean }) {
  return <span className={`truncate ${strong ? "font-semibold text-ink" : "text-ink-2"}`}>{name}</span>;
}

function ScoreCell({ value, strong }: { value: number | null; strong: boolean }) {
  return (
    <span className={`text-right font-mono tabular-nums ${strong ? "font-medium text-ink" : "text-ink-2"}`}>
      {value === null ? "" : <Score value={value} />}
    </span>
  );
}

/**
 * A changed score remounts (new key) and ticks up via @starting-style. The
 * first value never animates, so server-rendered scores paint immediately.
 */
function Score({ value }: { value: number }) {
  const [initial] = useState(value);
  return (
    <span key={value} className={value !== initial ? "score-tick" : undefined}>
      {value}
    </span>
  );
}
