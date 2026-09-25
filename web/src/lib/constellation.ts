import { heuristicLevel, type Candidate, type Role, type Sense } from "@core";
import { getLevels, getSenseFacts, putLevels, sameSynset, senseCounts, sensesFor, siblings, type DictRel } from "./db";
import { MODEL_GENERATE, chooseSenses, groqConfigured, predictLevels, suggestRelated } from "./groq";

export interface PoolResult { candidates: Candidate[]; targetLevel: number; targetTopics: string[]; ai: boolean }

const POS: Record<string, string> = { n: "noun", v: "verb", adj: "adjective", adv: "adverb" };
const cand = (r: DictRel, role: Role, source: "wordnet" | "ai"): Candidate => ({ lemma: r.lemma, senseId: r.sense_id, pos: POS[r.pos] ?? r.pos, role, level: 3, topics: [], simple: r.definition, source });

/**
 * Builds the candidate pool for a sense: WordNet's own relations first (authoritative), then AI suggestions that are checked against
 * the dictionary (a suggested word that is not in the dictionary is dropped), then difficulty for every word (cached; AI or heuristic).
 */
export async function buildPool(base: Sense, opts: { ai: boolean }): Promise<PoolResult> {
  const facts = await getSenseFacts(base.senseId);
  if (!facts) return { candidates: [], targetLevel: 3, targetTopics: [], ai: false };
  const out = new Map<string, Candidate>();
  const add = (c: Candidate) => { if (c.lemma !== base.lemma && !out.has(c.lemma)) out.set(c.lemma, c); };

  // Exact senses first: words in the same synset, and co-hyponyms (they share the hypernym, so the sense is known).
  for (const r of await sameSynset(facts.synset_id, facts.lemma)) add(cand(r, "same-meaning", "wordnet"));
  for (const r of await siblings(facts.broader ?? [], facts.lemma, facts.pos)) add(cand(r, "same-family", "wordnet"));

  // Lemma-level candidates (antonyms, hypernyms, AI suggestions) are ambiguous: the intended MEANING must be chosen, not assumed to be the first.
  const ambiguous: { lemma: string; role: Role; source: "wordnet" | "ai" }[] = [
    ...(facts.antonyms ?? []).map(l => ({ lemma: l, role: "opposite" as Role, source: "wordnet" as const })),
    ...(facts.broader ?? []).map(l => ({ lemma: l, role: "easier-bridge" as Role, source: "wordnet" as const })),
  ];
  let usedAi = false;
  if (opts.ai && groqConfigured()) {
    try {
      const suggested = await suggestRelated({ lemma: base.lemma, pos: base.pos, definition: base.definition });
      for (const sgg of suggested) ambiguous.push({ lemma: sgg.lemma, role: sgg.role, source: "ai" });
      usedAi = true;
    } catch (e) { console.error("suggestRelated failed", (e as Error).message); }
  }
  const options = await sensesFor([...new Set(ambiguous.map(a => a.lemma))], facts.pos);        // only words that really exist in the dictionary survive
  const todo = ambiguous.filter(a => options.has(a.lemma) && !out.has(a.lemma) && a.lemma !== base.lemma);
  let chosen = new Map<string, number>();
  if (todo.length && opts.ai && groqConfigured()) {
    try { chosen = await chooseSenses({ lemma: base.lemma, definition: base.definition }, todo.map(t => ({ lemma: t.lemma, role: t.role, meanings: options.get(t.lemma)!.map(r => r.definition) }))); }
    catch (e) { console.error("chooseSenses failed", (e as Error).message); usedAi = false; }   // without disambiguation the pool is not trustworthy enough to cache
  }
  for (const t of todo) {
    const rows = options.get(t.lemma)!;
    if (chosen.size) { const i = chosen.get(t.lemma); if (i === undefined || i < 0) continue; add(cand(rows[i], t.role, t.source)); }   // -1 or missing: no meaning fits, drop the word
    else if (t.source === "wordnet") add(cand(rows[0], t.role, t.source));                                                       // dictionary-only mode: WordNet's own relation, first sense
  }

  // difficulty + topics for the target and every candidate: cached first, then AI in batches, then a labelled heuristic
  const lemmas = [base.lemma, ...out.keys()];
  const levels = await getLevels(lemmas);
  const missing = lemmas.filter(l => !levels.has(l));
  let ranAi = false;
  if (missing.length && opts.ai && groqConfigured()) {
    try {
      for (let i = 0; i < missing.length; i += 40) {
        const got = await predictLevels(missing.slice(i, i + 40));
        await putLevels(got, MODEL_GENERATE);
        got.forEach(g => levels.set(g.lemma, { level: g.level, topics: g.topics, source: "ai" }));
      }
      ranAi = true;
    } catch (e) { console.error("predictLevels failed", (e as Error).message); }
  }
  const counts = await senseCounts(lemmas.filter(l => !levels.has(l)));
  const level = (l: string) => levels.get(l) ?? { level: heuristicLevel(l, counts.get(l) ?? 2, false), topics: [], source: "heuristic" };
  for (const c of out.values()) { const v = level(c.lemma); c.level = v.level; c.topics = v.topics; }
  const t = level(base.lemma);
  const aiComplete = usedAi && [...levels.values()].every(v => v.source === "ai") && (ranAi || missing.length === 0);
  return { candidates: [...out.values()], targetLevel: t.level, targetTopics: t.topics, ai: aiComplete };
}
