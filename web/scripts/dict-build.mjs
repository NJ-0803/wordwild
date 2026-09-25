// Builds dictionary rows from Open English WordNet 2025 (CC BY 4.0) + CMUdict, writes ../dictionary/build/senses.json.
// Run: node scripts/dict-build.mjs
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const RAW = new URL("../../dictionary/raw/", import.meta.url).pathname;
const OUT = new URL("../../dictionary/build/", import.meta.url).pathname;
const POS = { n: "n", v: "v", a: "adj", s: "adj", r: "adv" };
const valid = w => w.length <= 48 && /^[\p{L}]+(?:['’ -][\p{L}]+)*$/u.test(w);
const readJson = f => JSON.parse(readFileSync(join(RAW, f), "utf8"));

// synsets
const synsets = new Map();
for (const f of readdirSync(RAW).filter(f => /^(noun|verb)\..*\.json$|^(adj|adv)\.all\.json$/.test(f)))
  for (const [id, s] of Object.entries(readJson(f))) synsets.set(id, s);
const lemmaOf = id => (synsets.get(id)?.members?.[0] ?? "").replace(/_/g, " ");
const keyLemma = k => k.split("%")[0].replace(/_/g, " ");

// pronunciation (CMUdict is single-word only)
const cmu = new Map();
for (const line of readFileSync(join(RAW, "cmudict.dict"), "utf8").split("\n")) {
  const m = line.match(/^([^ (]+)(?:\(\d+\))? (.+)$/); if (m && !cmu.has(m[1])) cmu.set(m[1], m[2]);
}

const rows = []; let skippedProper = 0, skippedInvalid = 0;
for (const f of readdirSync(RAW).filter(f => /^entries-.*\.json$/.test(f))) {
  for (const [rawLemma, byPos] of Object.entries(readJson(f))) {
    const lemma = rawLemma.replace(/_/g, " ");
    if (lemma !== lemma.toLowerCase()) { skippedProper++; continue; }        // proper nouns (Heaven, Paris) are not vocabulary lessons
    if (!valid(lemma)) { skippedInvalid++; continue; }
    for (const [posKey, body] of Object.entries(byPos)) {
      const pos = POS[posKey]; if (!pos) continue;
      const ipa = body.pronunciation?.find(p => p.value)?.value ?? null;
      body.sense.forEach((sn, i) => {
        const syn = synsets.get(sn.synset); if (!syn?.definition?.[0]) return;
        rows.push({
          sense_id: sn.id, lemma, pos, rank: i + 1, synset_id: sn.synset,
          definition: syn.definition[0], examples: (syn.example ?? []).slice(0, 4),
          synonyms: [...new Set(syn.members.map(m => m.replace(/_/g, " ")).filter(m => m !== lemma && m === m.toLowerCase()))].slice(0, 8),
          antonyms: [...new Set((sn.antonym ?? []).map(keyLemma))].slice(0, 5),
          broader: [...new Set((syn.hypernym ?? []).map(lemmaOf).filter(Boolean))].slice(0, 3),
          ipa, arpabet: cmu.get(lemma) ?? null,
        });
      });
    }
  }
}
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "senses.json"), JSON.stringify(rows));
console.log(`senses: ${rows.length}, distinct lemmas: ${new Set(rows.map(r => r.lemma)).size}, skipped proper nouns: ${skippedProper}, invalid: ${skippedInvalid}, with examples: ${rows.filter(r => r.examples.length).length}, with cmudict: ${rows.filter(r => r.arpabet).length}`);
