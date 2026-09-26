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

// ---- The four questions that decide whether Wordwild is a habit or only a dictionary ----
console.log("\n=== The four questions ===");
const lbl = await q(`select label, count(distinct device) n from ww_metrics where name = 'first_word' group by label`);
const fw = Object.fromEntries(lbl.map(r => [r.label, Number(r.n)])); const fwTotal = Object.values(fw).reduce((a, b) => a + b, 0);
console.log(`1. How fast do people save their first word?  (${fwTotal} devices)`);
for (const [k, t] of [["lt30s", "under 30 seconds"], ["lt60s", "30 to 60 seconds"], ["lt3m", "1 to 3 minutes"], ["slower", "slower than 3 minutes"]]) console.log(`   ${pct(fw[k] ?? 0, fwTotal).padStart(4)}  ${t}`);
const savedD = await dev("word_saved"), firstRev = await dev("first_review");
console.log(`2. Of devices that saved a word, how many finished their first review?  ${pct(firstRev, savedD)}  (${firstRev} of ${savedD})`);
console.log("3. Return on day 3 and day 7 (opened the app that exact day / at any point up to it):");
for (const n of [3, 7]) {
  const r = (await q(`with first as (select device, min(day) d0 from ww_metrics where name = 'app_open' group by device)
    select count(*) filter (where d0 <= $1::int - $2::int) el,
      count(*) filter (where d0 <= $1::int - $2::int and exists (select 1 from ww_metrics m where m.device = first.device and m.name = 'app_open' and m.day = d0 + $2::int)) exact_d,
      count(*) filter (where d0 <= $1::int - $2::int and exists (select 1 from ww_metrics m where m.device = first.device and m.name = 'app_open' and m.day > d0 and m.day <= d0 + $2::int)) within_d from first`, [today, n]))[0];
  console.log(`   Day ${n}: on the day ${pct(Number(r.exact_d), Number(r.el)).padStart(4)}   within ${n} days ${pct(Number(r.within_d), Number(r.el)).padStart(4)}   (${r.el} devices old enough)`);
}
const rc = Object.fromEntries((await q(`select name, count(*) n from ww_metrics where name like 'recall_%' group by name`)).map(r => [r.name, Number(r.n)]));
const rcTotal = (rc.recall_unassisted ?? 0) + (rc.recall_assisted ?? 0) + (rc.recall_forgot ?? 0);
console.log(`4. When people review a saved word, how often do they recall it without help?  ${pct(rc.recall_unassisted ?? 0, rcTotal)} unassisted, ${pct(rc.recall_assisted ?? 0, rcTotal)} with help, ${pct(rc.recall_forgot ?? 0, rcTotal)} forgot  (${rcTotal} reviews)`);
