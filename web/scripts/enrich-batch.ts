// Batch evaluation of the enrichment pipeline on real words. Does NOT write to the cache. Prints outcome per word.
import { lookupDict } from "../src/lib/db.ts";
import { generateDraft, solveBlind, MODEL_GENERATE } from "../src/lib/groq.ts";
import { enrich } from "@core";

const words = (process.argv[2] ?? "resilient,serendipity,mitigate,frugal,ambiguous,reluctant,diligent,meticulous,console,bank").split(",");
const rows: string[] = []; let pass = 0; const stages: Record<string, number> = {};
for (const w of words) {
  await new Promise(ok => setTimeout(ok, 6000));     // stay under the free-tier burst limit
  const hit = await lookupDict(w); if (!hit) { rows.push(`${w.padEnd(12)} not in dictionary`); continue; }
  const base = hit.senses[0]; const t0 = Date.now();
  const out = await enrich(base, m => generateDraft(m), solveBlind, MODEL_GENERATE);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (out.ok) { pass++; rows.push(`${w.padEnd(12)} PASS${out.dropped.length ? ` (dropped ${out.dropped.join(",")})` : ""}  ${secs}s  [${base.pos}] ${base.definition.slice(0, 40)}`); }
  else { stages[out.stage] = (stages[out.stage] ?? 0) + 1; rows.push(`${w.padEnd(12)} ${out.transient ? "TRANSIENT" : "REJECT"}@${out.stage} ${secs}s  ${out.problems.slice(0, 2).join(" ; ").slice(0, 150)}`); }
}
console.log(rows.join("\n")); console.log(`\npassed ${pass}/${words.length}; failures by stage:`, stages);
