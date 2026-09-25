// LIVE: generate + verify "Go deeper" for a few words (no cache writes).
import { getDictSense, lemmaExists } from "../src/lib/db.ts";
import { draftDepth, solveBlind, MODEL_GENERATE } from "../src/lib/groq.ts";
import { makeDepth } from "@core";
const ids = (process.argv[2] ?? "skeptical%5:00:00:distrustful:00").split(",");
for (const id of ids) {
  const b = await getDictSense(id); if (!b) { console.log("no sense", id); continue; }
  const t0 = Date.now();
  const out = await makeDepth(b.lemma, () => draftDepth({ lemma: b.lemma, pos: b.pos, definition: b.definition, synonyms: b.nearSynonyms.map(n => n.lemma) }), solveBlind, MODEL_GENERATE, lemmaExists);
  console.log(`\n=== ${b.lemma} (${((Date.now() - t0) / 1000).toFixed(1)}s): ${out.ok ? "PASSED" : "REJECTED " + out.stage + (out.transient ? " (transient)" : "") + " " + out.problems.join("; ")}`);
  if (out.ok) { const d = out.depth; console.log(`feel   : [${d.feel.tone}] ${d.feel.note}`); console.log(`ladder : ${d.ladder.join(" -> ") || "(dropped)"}`); d.onlyThisWord.forEach(o => console.log(`only   : ${o.sentence}\n         not "${o.other}": ${o.whyNot}`)); if (d.dropped.length) console.log("dropped:", d.dropped); }
}
