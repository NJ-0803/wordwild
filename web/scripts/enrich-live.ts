// LIVE run of the enrichment pipeline against Groq for one dictionary sense. Prints the draft for human review.
// Usage: npm run enrich:live -- "skeptical%5:00:00:distrustful:00"
import { getDictSense } from "../src/lib/db.ts";
import { generateDraft, solveBlind, MODEL_GENERATE, MODEL_VERIFY } from "../src/lib/groq.ts";
import { enrich, type Draft } from "@core";

const id = process.argv[2] ?? "skeptical%5:00:00:distrustful:00";
const base = await getDictSense(id);
if (!base) { console.log("no such sense:", id); process.exit(1); }
console.log(`Sense: ${base.lemma} (${base.pos}) — ${base.definition}`);
console.log(`Models: generate=${MODEL_GENERATE}  verify=${MODEL_VERIFY}\n`);
let captured: Draft | null = null; const t0 = Date.now();
const solveLog: string[] = [];
const out = await enrich(base, async m => { captured = await generateDraft(m); return captured; },
  async q => { const r = await solveBlind(q); solveLog.push(`  Q: ${q.prompt.slice(0, 70)}  -> picked #${r.answer} "${q.options[r.answer]?.slice(0, 40)}" alsoCorrect=${r.alsoCorrect}`); return r; }, MODEL_GENERATE);
console.log(`Finished in ${((Date.now() - t0) / 1000).toFixed(1)}s. Outcome: ${out.ok ? "PASSED ALL GATES" : `REJECTED at stage "${out.stage}"`}`);
if (!out.ok) console.log("Problems:", out.problems);
if (captured) {
  const d = captured as Draft;
  console.log("\n--- DRAFT ---");
  console.log("simple :", d.simple); console.log("hindi  :", d.hindi); console.log("level  :", d.difficulty, d.register);
  console.log("collocations:", d.collocations.join(" | ")); console.log("suitable:", d.suitableSituations.join(" ; "));
  d.examples.forEach((e, i) => console.log(`example ${i + 1} [${e.context}]:`, e.text));
  d.practice.forEach((p, i) => { console.log(`\npractice ${i + 1} (${p.kind}/${p.skill}): ${p.prompt}`); p.options.forEach((o, k) => console.log(`   ${k === p.correctIndex ? "✔" : " "} ${o.text}${o.why ? "   — " + o.why : ""}`)); console.log(`   explanation: ${p.explanation} | hint: ${p.hint}`); });
  console.log(`\nexplain: ${d.explain.prompt}\n  concepts: ${d.explain.concepts.map(c => c.name + "=[" + c.terms.join(",") + "]").join("  ")}\n  model answer: ${d.explain.modelAnswer}`);
}
console.log("\n--- BLIND SOLVER ---"); console.log(solveLog.join("\n") || "(not reached)");
