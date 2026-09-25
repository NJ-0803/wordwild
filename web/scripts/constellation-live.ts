// LIVE: builds a constellation pool (WordNet + Groq) for one sense and shows what three different learners would get. Does not cache.
import { getDictSense } from "../src/lib/db.ts";
import { buildPool } from "../src/lib/constellation.ts";
import { selectConstellation, estimateLevel, ROLE_LABEL } from "@core";

const id = process.argv[2] ?? "skeptical%5:00:00:distrustful:00";
const base = await getDictSense(id); if (!base) { console.log("no sense"); process.exit(1); }
const t0 = Date.now(); const pool = await buildPool(base, { ai: true });
console.log(`Target: ${base.lemma} (${base.pos}) level=${pool.targetLevel} topics=[${pool.targetTopics}]  pool=${pool.candidates.length} words  aiComplete=${pool.ai}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
const bySource = pool.candidates.reduce<Record<string, number>>((a, c) => { a[c.source] = (a[c.source] ?? 0) + 1; return a; }, {});
console.log("pool by source:", bySource);
console.log("pool sample:", pool.candidates.slice(0, 40).map(c => `${c.lemma}(${c.role.slice(0, 4)},L${c.level})`).join(" "));
const learners = [
  { name: "just starting to read English", est: estimateLevel({ readingComfort: 1, interests: ["cricket"], updatedAt: 1 }, []), interests: ["cricket"] },
  { name: "reads simple messages, likes cooking", est: estimateLevel({ readingComfort: 2, interests: ["cooking"], updatedAt: 1 }, []), interests: ["cooking"] },
  { name: "reads news and work emails", est: estimateLevel({ readingComfort: 3, interests: ["business", "news"], updatedAt: 1 }, []), interests: ["business", "news"] },
];
for (const l of learners) {
  const picks = selectConstellation({ target: { lemma: base.lemma, level: pool.targetLevel }, learner: { level: l.est.level, interests: l.interests }, candidates: pool.candidates, known: new Set() });
  console.log(`\n== ${l.name} (level ${l.est.level.toFixed(1)}) -> ${picks.length} words`);
  picks.forEach(p => console.log(`  L${p.level} ${p.lemma.padEnd(13)} [${ROLE_LABEL[p.role]}${p.source === "ai" ? ", AI" : ""}]  ${p.simple.slice(0, 50)}\n        why: ${p.why}`));
}
