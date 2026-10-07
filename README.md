# Matchday

A fixtures, results and ladder page built for the traffic of a match day, on **real data**: the Wallabies' 2026 tests (including both Bledisloe Cup matches), the full 2026 Super Rugby Pacific season, and the Rugby World Cup 2027 pool fixtures.

The fixtures are in the HTML on first load. During a match, the score updates in open tabs without a reload. When a match kicks off or finishes, the cached page refreshes itself without a redeploy.

**Live:** _<vercel url>_ · **Stack:** pnpm, Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind CSS 4, MongoDB Atlas, Vercel

**Design:** editorial rather than app-like: Fraunces for display, Manrope for text, IBM Plex Mono for scores and times, set on ruled rows instead of boxed cards. Colour carries meaning: **gold = in play now, green = settled**. Motion is limited to what explains a change: a score ticks when it updates, and a small pulse marks a live match. Nothing animates on first paint, because entrance animations delay LCP.

## Why I built it

While looking at how fixtures load on a large sports site, I noticed the fixture list is fetched in the browser after the page starts up. On a mid-range phone over 4G (Lighthouse, mobile), it took about 14 seconds for the first fixture to appear. Fixtures and results pages take the biggest spikes on match day, and those spikes will only grow towards 2027. So I wanted to see how small a version of that page could be when it's built for that load from the start.

## Data

Fixtures, scores and the official ladder come from **ESPN's public scoreboard JSON**. It's unofficial and undocumented, so the app treats it as untrusted input: [`src/lib/espn.ts`](src/lib/espn.ts) parses it defensively and maps it into the app's own types before anything is stored.

```
ESPN feed ──sync──▶ MongoDB ──"use cache" + tags──▶ prerendered pages
    │                  ▲
    └──/api/live───────┘  (during matches: write-through + revalidate on kick-off / full time)
```

What the feed doesn't give you, and how the app handles it:

| Gap in the feed | Handling |
|---|---|
| No time zones, and some wrong locations | Venues are pinned by feed id in [`venues.ts`](src/lib/venues.ts). Corrections are marked in the code: North Harbour Stadium was listed as Albany, **USA** (it's Auckland), Estadio 23 de Agosto as **El Salvador** (it's San Salvador de Jujuy, Argentina), and Four R Stadium had no location at all. Unknown venues fall back to the country and get flagged in the sync report. |
| No finals labels | Once a season is complete, every team has played the official number of regular-season games. Any game after that is a final, and finals are named from the last weekend backwards. |
| No try counts per match | The ladder computes everything it can from the results (played, W/D/L, points for and against, losing bonus points). Only try bonus points are joined in from the official table. |

**Reconciliation.** Every sync compares the computed ladder with ESPN's official table, team by team: played, W/D/L, points for and against, losing bonus points, total points and position. The result is stored and shown on the page. Currently: **11/11 teams match**. If the feed and the computation ever disagree, the badge turns gold and lists the differences.

## Decisions

| Problem | What this does | Where |
|---|---|---|
| Fixtures painted late, client-side | Fixtures are fetched in a cached server function and prerendered into the HTML. | [`data.ts`](src/lib/data.ts), [`page.tsx`](src/app/fixtures/[competition]/page.tsx) |
| Thousands of tabs polling during a match | `/api/live` sends `s-maxage=10, stale-while-revalidate=20`, so each region calls the function (and the feed) at most once every 10 seconds per competition, however many fans are watching. Clients only poll inside a kick-off window. | [`api/live`](src/app/api/live/route.ts) |
| Pages lagging behind live state | The live endpoint writes changes through to MongoDB and calls `revalidateTag(tag, "max")` when a match changes state, so the cached page catches up without waiting for the next sync. | [`sync.ts`](src/lib/sync.ts) `applyLiveEvents` |
| Scheduled sync on a free plan | Vercel's free plan only allows daily crons, so a GitHub Actions schedule calls the signed `/api/sync` endpoint every 30 minutes. Live scores don't depend on it. | [`.github/workflows/sync.yml`](.github/workflows/sync.yml), [`api/sync`](src/app/api/sync/route.ts) |
| Ladder drifting from results | One MongoDB aggregation over completed regular-season fixtures, cached under the same tag as the fixtures, and reconciled against the official table. | [`ladder-pipeline.ts`](src/lib/ladder-pipeline.ts) |
| Ambiguous kick-off times | Every time renders in venue time with a zone label (`en-AU`), plus a "Your time" line for viewers elsewhere. The World Cup venue list shows why this matters: daylight saving starts two days into the tournament in Adelaide and Melbourne (ACST → ACDT, AEST → AEDT) but not in Brisbane or Perth. | [`format.ts`](src/lib/format.ts), [`season-summary.tsx`](src/components/season-summary.tsx) |
| Layout shift | Scores sit in a fixed-width column. A "Your time" line fills a reserved slot after hydration. Three web fonts load through `next/font`, which generates size-matched fallbacks. CLS is 0. | |
| Accessibility | Pinch-zoom allowed, AA contrast throughout (the palette's muted grey is darkened to 5:1, and gold is only used as a fill under dark text), labelled filters with `aria-pressed`, a real `<table>` for the ladder, 44px touch targets, and a readable score label on each match row. | |

**On Edge Functions:** Next.js 16 deprecates the Edge runtime for routes, and the MongoDB driver needs Node anyway. What used to be done at the edge is done with CDN caching headers, which handles match-day bursts better because most requests never reach a function.

## Results

Lighthouse 12, mobile preset, simulated throttling. Run `pnpm lighthouse <url>` to reproduce (median of 3).

| Metric | Reference page | This prototype |
|---|---|---|
| Performance | 38 | 96–97 |
| Accessibility | 71 | 100 |
| LCP | 23.1 s | 2.5–2.7 s |
| Total Blocking Time | 1,930 ms | 40–50 ms |
| CLS | 0.001 | 0 |
| Page weight | 3.2 MB | ~290 KB |

**This is not a like-for-like comparison.** The prototype carries no ads, analytics or consent tooling, and those account for a large share of a production site's JavaScript. The prototype numbers are from `localhost` (all three competition pages) and will be replaced with the deployed numbers. The point is the architecture: data in the HTML, a cached and reconciled ladder, and live updates that don't re-render the page.

## Run it

```bash
cp .env.example .env
pnpm install
pnpm db:up           # local MongoDB 8 in Docker (or point MONGODB_URI at Atlas)
pnpm sync            # pulls all three competitions and prints the reconciliation report
pnpm build && pnpm start
```

### Testing the live path without a live match

`ESPN_BASE_URL` points the feed client somewhere else, for example a local mock that returns a recorded scoreboard with one match set to in-progress, half-time or full-time. That's how the kick-off → live → half time → full time flow was tested before a real match. Re-run `pnpm sync` afterwards to restore real data.

### Deploy (Vercel + Atlas)

1. Create an Atlas cluster (M0 is fine), in `ap-southeast-2` for an Australian audience (the live deployment's cluster is there). Allow Vercel's egress IPs, or `0.0.0.0/0` for a demo.
2. `MONGODB_URI=<atlas uri> pnpm sync`
3. Import the repo in Vercel and set `MONGODB_URI`, `MONGODB_DB`, `REVALIDATE_SECRET`. The function region is pinned to `syd1` in `vercel.json`, next to the cluster. Vercel detects pnpm from the lockfile; add `ENABLE_EXPERIMENTAL_COREPACK=1` as well so it uses the exact version pinned in `packageManager` (pnpm 11).
4. In the GitHub repo, add the secrets `SITE_URL` and `REVALIDATE_SECRET` to enable the scheduled sync.

## Known trade-offs / next steps

- The feed is unofficial and can change without notice. Moving to an official provider means replacing [`espn.ts`](src/lib/espn.ts) with another adapter. Nothing else changes.
- Unknown competition URLs render the 404 page with `noindex`, but with HTTP 200, a side effect of partial prerendering streaming the response before `notFound()` runs.
- On Vercel, `revalidateTag` purges the CDN as well. On another host, pair it with a CDN purge.
- Next steps: round numbers (the feed doesn't carry them), Wallaroos tests, World Cup pool tables once results exist, and an SSE channel to replace polling when there are many concurrent matches.

---

Data: ESPN public scoreboard feed (unofficial). Not affiliated with Rugby Australia, Super Rugby, World Rugby or ESPN.
