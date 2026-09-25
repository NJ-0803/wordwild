// What the anonymous counts say. Run: npm run metrics   (reads the database; prints aggregates only)
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
const q = async (text: string, p: unknown[] = []) => (await sql.query(text, p)) as unknown as Record<string, string>[];
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "n/a");

const total = Number((await q(`select count(distinct device) n from ww_metrics`))[0].n);
const range = (await q(`select min(day) a, max(day) b from ww_metrics`))[0];
console.log(`Devices seen: ${total}   Days of data: ${range.a ? Number(range.b) - Number(range.a) + 1 : 0}\n`);
if (!total) { console.log("No data yet."); process.exit(0); }

// Return rates: of devices first seen at least N days ago, how many opened the app on a later day within N days (D1 = next day, D7 = within 7, D30 = within 30)
const today = Math.floor(Date.now() / 86_400_000);
console.log("Return (of devices old enough to measure):");
for (const n of [1, 7, 30]) {
  const r = (await q(`with first as (select device, min(day) d0 from ww_metrics where name = 'app_open' group by device)
    select count(*) filter (where d0 <= $1::int - $2::int) as eligible,
           count(*) filter (where d0 <= $1::int - $2::int and exists (select 1 from ww_metrics m where m.device = first.device and m.name = 'app_open' and m.day > d0 and m.day <= d0 + $2::int)) as returned from first`, [today, n]))[0];
  console.log(`  D${String(n).padEnd(2)}  ${pct(Number(r.returned), Number(r.eligible)).padStart(4)}   (${r.returned} of ${r.eligible})`);
}
const active = Number((await q(`select count(distinct device) n from ww_metrics where name = 'app_open'`))[0].n);
const dev = async (name: string, label?: string) => Number((await q(`select count(distinct device) n from ww_metrics where name = $1 ${label ? "and label = $2" : ""}`, label ? [name, label] : [name]))[0].n);
console.log("\nOf devices that opened the app:");
for (const [n, l] of [["word_saved", "saved a word"], ["practice_done", "practised"], ["word_secure", "made a word secure (the success metric)"], ["journey_complete", "finished a daily journey"], ["scene_finished", "finished a story scene"], ["coach_seen", "saw the coach"], ["share_card", "shared a card"]] as const)
  console.log(`  ${pct(await dev(n), active).padStart(4)}  ${l}`);
const secure30 = (await q(`with first as (select device, min(day) d0 from ww_metrics group by device) select count(*) filter (where d0 <= $1::int - 30) el, count(*) filter (where d0 <= $1::int - 30 and exists (select 1 from ww_metrics m where m.device = first.device and m.name = 'word_secure' and m.day >= d0 + 30)) ok from first`, [today]))[0];
console.log(`  Words secure after 30 days: ${secure30.ok} of ${secure30.el} devices old enough (secure event 30 or more days after first visit)`);
console.log("\nLookup results (what fails):");
for (const r of await q(`select label, count(*) n from ww_metrics where name = 'lookup' group by label order by n desc`)) console.log(`  ${String(r.n).padStart(5)}  ${r.label}`);
const ls = await q(`select count(*) filter (where label like 'found%') f, count(*) filter (where label like 'unknown%') u, count(*) t from ww_metrics where name = 'lookup'`);
console.log(`  Not found: ${pct(Number(ls[0].u), Number(ls[0].t))} of ${ls[0].t} lookups`);
