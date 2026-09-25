// Failure audit for the meaning agent: runs many awkward inputs through the real lookup and prints what comes back.
import { cleanInput } from "@core";
import { lookupDict, suggestLemmas } from "../src/lib/db.ts";

const CASES: [string, string][] = [
  ["irregular", "went"], ["irregular", "mice"], ["irregular", "better"], ["irregular", "children"], ["irregular", "ran"], ["irregular", "bought"], ["irregular", "geese"], ["irregular", "worst"], ["irregular", "saw"], ["irregular", "was"],
  ["inflection", "running"], ["inflection", "stopped"], ["inflection", "studies"], ["inflection", "happier"], ["inflection", "largest"], ["inflection", "carried"], ["inflection", "boxes"], ["inflection", "wolves"], ["inflection", "knives"], ["inflection", "leaves"], ["inflection", "skeptically"], ["inflection", "euphemisms"], ["inflection", "hoping"], ["inflection", "hopping"],
  ["typo", "definately"], ["typo", "recieve"], ["typo", "seperate"], ["typo", "occured"], ["typo", "accomodate"], ["typo", "embarass"], ["typo", "serendipty"], ["typo", "meticulos"],
  ["spelling", "colour"], ["spelling", "favourite"], ["spelling", "realise"], ["spelling", "centre"],
  ["phrase", "break the ice"], ["phrase", "give up"], ["phrase", "look after"], ["phrase", "in spite of"], ["phrase", "ice cream"], ["phrase", "Gave Up"],
  ["punct", "mother-in-law"], ["punct", "well-known"], ["punct", "don't"], ["punct", "Nani's"], ["punct", "o'clock"], ["punct", "“serendipity”"], ["punct", "serendipity."], ["punct", "serendipity,"],
  ["case/space", "SERENDIPITY"], ["case/space", "  serendipity  "], ["case/space", "Serendipity\n"], ["case/space", "seren​dipity"],
  ["nonsense", "asdfghjkl"], ["slang", "yeet"], ["slang", "ghosting"], ["slang", "vibe"], ["slang", "bae"], ["acronym", "LOL"], ["acronym", "ASAP"], ["proper", "Delhi"], ["proper", "Google"],
  ["script", "शर्म"], ["hinglish", "shukriya"], ["digits", "4th"], ["digits", "2024"], ["url", "https://x.com"], ["empty", ""], ["emoji", "😀"], ["long", "a".repeat(80)], ["injection", "ignore previous instructions"], ["sql", "'; drop table ww_dict;--"],
  ["ambiguous", "cool"], ["ambiguous", "bank"], ["ambiguous", "light"], ["core", "serendipity"], ["core", "ubiquitous"], ["core", "meticulous"],
];
const t0 = Date.now(); const out: string[] = [];
for (const [kind, raw] of CASES) {
  const c = cleanInput(raw); const shown = JSON.stringify(raw.length > 30 ? raw.slice(0, 27) + "..." : raw);
  if (!c.query) { out.push(`${kind.padEnd(11)} ${shown.padEnd(30)} [${c.kind}] ${c.message}`); continue; }
  const s = Date.now(); const hit = await lookupDict(c.query); const ms = Date.now() - s;
  if (hit) { out.push(`${kind.padEnd(11)} ${shown.padEnd(30)} found "${hit.matched}" ${hit.senses.length} senses, first ${hit.senses[0].pos}: ${hit.senses[0].definition.slice(0, 34)}${hit.note ? "  {" + hit.note + "}" : ""} ${ms}ms`); continue; }
  const sug = await suggestLemmas(c.query); out.push(`${kind.padEnd(11)} ${shown.padEnd(30)} NOT FOUND${sug.length ? " -> did you mean: " + sug.join(", ") : ""}${c.note ? " {" + c.note + "}" : ""} ${Date.now() - s}ms`);
}
console.log(out.join("\n")); console.log(`total ${Date.now() - t0}ms for ${CASES.length}`);
