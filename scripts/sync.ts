/**
 * Pull every competition from the feed into MongoDB, then ask a running app
 * (if any) to revalidate. Run before the first build so pages have data:
 *
 *   pnpm sync
 */
import "dotenv/config";
import { competitions } from "../src/lib/competitions";
import { ensureIndexes, syncCompetition } from "../src/lib/sync";

async function revalidate() {
  const site = process.env.SITE_URL;
  if (!site) return;
  try {
    const res = await fetch(`${site}/api/revalidate`, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.REVALIDATE_SECRET}`, "content-type": "application/json" },
      body: "{}",
    });
    console.log(`revalidate ${site} -> ${res.status}`);
  } catch {
    console.log(`(no app running at ${site}; skipped revalidation)`);
  }
}

async function main() {
  await ensureIndexes();
  let ok = true;
  for (const c of competitions) {
    try {
      const r = await syncCompetition(c);
      console.log(`\n${c.name}: ${r.fixtures} fixtures (${r.upserted} new, ${r.modified} updated, ${r.removed} removed)`);
      if (r.unknownVenues.length) console.log(`  unknown venues (add to src/lib/venues.ts): ${r.unknownVenues.join("; ")}`);
      if (r.reconciliation) {
        const { teams, matched, mismatches } = r.reconciliation;
        console.log(`  ladder reconciliation: ${matched}/${teams} teams match the official table`);
        for (const m of mismatches) console.log(`    ${m.team} ${m.field}: ours ${m.ours}, official ${m.official}`);
      }
    } catch (err) {
      ok = false;
      console.error(`\n${c.name}: sync failed`, err);
    }
  }
  await revalidate();
  process.exit(ok ? 0 : 1);
}

main();
