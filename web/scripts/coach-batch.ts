// Pre-generates checked Word Coach content for a core vocabulary, so a word page already has examples for a visitor who has not signed in.
// Resumable (skips words already done), gentle with the free tier (pauses between words, stops when Groq keeps refusing).
//   node --no-warnings --env-file=.env.local --import ./scripts/alias.mjs --experimental-strip-types scripts/coach-batch.ts [words.txt] [--max N]
import { readFileSync } from "node:fs";
import { COACH_PROMPT_VERSION, makeCoach } from "@core";
import { firstDefinition, getCoach, lookupDict, putCoach } from "../src/lib/db.ts";
import { MODEL_GENERATE, commonSense, draftCoach, solveBlind, solveMany, lastUsed } from "../src/lib/groq.ts";

const file = process.argv[2]?.endsWith(".txt") ? process.argv[2] : "scripts/words-core.txt";
const max = Number(process.argv[process.argv.indexOf("--max") + 1]) || Infinity;
const words = [...new Set(readFileSync(file, "utf8").split(/\s+/).map(w => w.trim().toLowerCase()).filter(Boolean))];
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
let done = 0, skipped = 0, failed = 0, transientRun = 0; const started = Date.now();
const log = (m: string) => console.log(`[${Math.round((Date.now() - started) / 1000)}s] ${m}`);

for (const w of words) {
  if (done >= max) break;
  try {
    const hit = await lookupDict(w); if (!hit) { skipped++; log(`${w}: not in dictionary`); continue; }
    const own = hit.senses.filter(s => s.lemma === hit.matched && s.senseId.includes("%"));
    if (!own.length) { skipped++; continue; }
    const idx = own.length > 1 ? await commonSense(w, own.map(s => s.definition)) : 0; const s = own[idx];
    if (await getCoach(s.senseId, COACH_PROMPT_VERSION)) { skipped++; continue; }
    const sib = hit.senses.filter(x => x.lemma === s.lemma && x.senseId !== s.senseId);
    const out = await makeCoach(s.lemma, { definition: s.definition, pos: s.pos, checkPos: sib.some(x => x.pos !== s.pos), decoys: sib.map(x => x.definition).slice(0, 2) },
      (p) => draftCoach({ lemma: s.lemma, pos: s.pos, definition: s.definition, synonyms: s.nearSynonyms.map(n => n.lemma) }, p), solveBlind, () => lastUsed || MODEL_GENERATE, firstDefinition, solveMany);
    if (out.ok) { await putCoach(s.senseId, out.coach, out.coach.generatedBy, COACH_PROMPT_VERSION); done++; transientRun = 0; log(`OK   ${w} (${s.pos}) ${out.coach.examples.length} examples${out.coach.dropped.length ? `, dropped ${out.coach.dropped.length}` : ""}`); }
    else if (out.transient) { transientRun++; failed++; log(`BUSY ${w}: ${out.problems[0]}`); if (transientRun >= 5) { log("Groq keeps refusing (likely a rate or daily limit). Stopping. Run again later; finished words are kept."); break; } await sleep(20_000); }
    else { failed++; transientRun = 0; log(`SKIP ${w}: ${out.stage} ${out.problems[0]}`); }
  } catch (e) { failed++; transientRun++; log(`ERR  ${w}: ${(e as Error).message.slice(0, 100)}`); if (transientRun >= 5) { log("Too many errors in a row. Stopping."); break; } await sleep(15_000); }
  await sleep(3000);
}
log(`finished: ${done} new, ${skipped} skipped, ${failed} failed, of ${words.length} words`);
