// Checks every puzzle word against the dictionary: it must exist as its own entry (not only as a form of another word) and have a definition.
//   node --no-warnings --env-file=.env.local --import ./scripts/alias.mjs --experimental-strip-types scripts/play-check.ts [--fix]
import { readFileSync, writeFileSync } from "node:fs";
import { ANSWERS_5, SCRAMBLE, MATCH_WORDS, SCRAMBLE_MEDIUM, SCRAMBLE_HARD, SCRAMBLE_SUPER } from "@core";
import { lookupDict } from "../src/lib/db.ts";

const FIX = process.argv.includes("--fix");
const lists: [string, readonly string[]][] = [["ANSWERS_5", ANSWERS_5], ["SCRAMBLE", SCRAMBLE], ["MATCH_WORDS", MATCH_WORDS], ["SCRAMBLE_MEDIUM", SCRAMBLE_MEDIUM], ["SCRAMBLE_HARD", SCRAMBLE_HARD], ["SCRAMBLE_SUPER", SCRAMBLE_SUPER]];
const bad: Record<string, string[]> = {};
for (const [name, list] of lists) {
  bad[name] = [];
  for (let i = 0; i < list.length; i += 12) {
    await Promise.all(list.slice(i, i + 12).map(async w => {
      const h = await lookupDict(w);
      if (!h || h.matched !== w || !h.senses.some(s => s.lemma === w && s.definition.length > 10)) bad[name].push(w);
    }));
  }
  console.log(`${name}: ${list.length} words, ${bad[name].length} not explainable${bad[name].length ? ": " + bad[name].join(" ") : ""}`);
}
if (FIX) {
  const path = new URL("../../core/src/playwords.ts", import.meta.url); let src = readFileSync(path, "utf8");
  for (const [name, words] of Object.entries(bad)) for (const w of words) src = src.replace(new RegExp(`(export const ${name} = \`[^\`]*?)\\b${w}\\b ?`), "$1");
  writeFileSync(path, src); console.log("removed them from core/src/playwords.ts");
}
