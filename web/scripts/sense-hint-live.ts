import { lookupDict } from "../src/lib/db.ts";
import { senseFromContext } from "../src/lib/groq.ts";
const cases: [string, string][] = [["bank", "I went to the bank to deposit my salary."], ["bank", "We sat on the bank of the river and watched the boats."], ["cool", "That new song is so cool!"], ["light", "The bag is very light, I can carry it easily."], ["bank", "Yesterday was a good day."]];
for (const [w, sentence] of cases) {
  const h = await lookupDict(w); if (!h) continue; const defs = h.senses.map(s => s.definition); const i = await senseFromContext(w, sentence, defs);
  console.log(`${w.padEnd(6)} "${sentence}"\n       -> ${i < 0 ? "no suggestion (unclear)" : `${i}: ${h.senses[i].pos} ${defs[i].slice(0, 70)}`}`);
}
