#!/usr/bin/env bash
# Before/after comparison under identical settings (Lighthouse 12, mobile,
# simulated throttling, 3 runs each, median reported).
#
#   pnpm lighthouse https://your-deployment.vercel.app/fixtures/wallabies
set -euo pipefail

TARGET="${1:?Usage: pnpm lighthouse <prototype-url>}"
BASELINE="https://www.rugby.com.au/fixtures-results"
OUT="lighthouse"
RUNS=3
mkdir -p "$OUT"

run() {
  local name=$1 url=$2
  for i in $(seq 1 "$RUNS"); do
    pnpm dlx lighthouse@12 "$url" --quiet --chrome-flags="--headless=new" \
      --only-categories=performance,accessibility,best-practices \
      --output=json --output-path="$OUT/$name-$i.json" >/dev/null 2>&1
  done
}

run baseline "$BASELINE"
run prototype "$TARGET"

node - "$OUT" "$RUNS" <<'JS'
const [dir, runs] = process.argv.slice(2);
const median = (xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const metrics = {
  "Performance": (r) => r.categories.performance.score * 100,
  "Accessibility": (r) => r.categories.accessibility.score * 100,
  "LCP (s)": (r) => r.audits["largest-contentful-paint"].numericValue / 1000,
  "TBT (ms)": (r) => r.audits["total-blocking-time"].numericValue,
  "CLS": (r) => r.audits["cumulative-layout-shift"].numericValue,
  "Page weight (KB)": (r) => r.audits["total-byte-weight"].numericValue / 1024,
};
const load = (name) => Array.from({ length: +runs }, (_, i) => require(`${process.cwd()}/${dir}/${name}-${i + 1}.json`));
const [base, proto] = [load("baseline"), load("prototype")];
console.log(`| Metric (median of ${runs}) | Baseline | Prototype |\n|---|---|---|`);
for (const [label, fn] of Object.entries(metrics)) {
  const fmt = (rs) => { const v = median(rs.map(fn)); return label === "CLS" ? v.toFixed(3) : v.toFixed(v < 10 ? 1 : 0); };
  console.log(`| ${label} | ${fmt(base)} | ${fmt(proto)} |`);
}
JS
