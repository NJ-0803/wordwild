// Live Word Coach run against the real dictionary and Groq. Prints what would be shown, what was dropped, and how long it took.
import { makeCoach, COACH_PROMPT_VERSION } from "@core";
import { lookupDict, firstDefinition, putCoach } from "../src/lib/db.ts";
import { MODEL_GENERATE, draftCoach, solveBlind } from "../src/lib/groq.ts";

const words = (process.argv[2] ?? "meticulous,ubiquitous,skeptical,cool").split(",");
for (const w of words) {
  const hit = await lookupDict(w); if (!hit) { console.log(`\n${w}: not in dictionary`); continue; }
  const s = hit.senses[0]; const t0 = Date.now();
  const out = await makeCoach(s.lemma, { definition: s.definition, pos: s.pos, checkPos: hit.senses.some(x => x.lemma === s.lemma && x.pos !== s.pos), decoys: hit.senses.filter(x => x.lemma === s.lemma && x.senseId !== s.senseId).map(x => x.definition).slice(0, 2) }, (problems) => draftCoach({ lemma: s.lemma, pos: s.pos, definition: s.definition, synonyms: s.nearSynonyms.map(n => n.lemma) }, problems), solveBlind, MODEL_GENERATE, firstDefinition);
  const ms = Date.now() - t0;
  console.log(`\n=== ${s.lemma} (${s.pos}): ${s.definition.slice(0, 60)}  [${ms} ms${ms > 3000 ? " > 3s target" : ""}]`);
  if (!out.ok) { console.log(`  FAILED at ${out.stage}${out.transient ? " (transient)" : ""}: ${out.problems.join(" | ")}`); continue; }
  for (const e of out.coach.examples) console.log(`  ${e.intent.padEnd(9)} ${e.sentence}`);
  if (process.argv[3] === "--save") { await putCoach(s.senseId, out.coach, MODEL_GENERATE, COACH_PROMPT_VERSION); console.log("  saved to the shared cache"); }
  console.log(`  hook      ${out.coach.memoryHook}`);
  for (const c of out.coach.confusables) console.log(`  vs ${c.word.padEnd(10)} ${c.difference}`);
  for (const n of out.coach.notFor) console.log(`  avoid     ${n}`);
  if (out.coach.dropped.length) console.log(`  dropped   ${out.coach.dropped.join(" | ")}`);
}
