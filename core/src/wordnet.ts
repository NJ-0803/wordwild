import type { Sense } from './types.ts';

/** A row of ww_dict: facts from Open English WordNet 2025 (CC BY 4.0) plus CMUdict pronunciation. */
export interface DictRow {
  sense_id: string; lemma: string; pos: 'n' | 'v' | 'adj' | 'adv'; rank: number; synset_id: string; definition: string;
  examples: string[]; synonyms: string[]; antonyms: string[]; broader: string[]; ipa: string | null; arpabet: string | null;
  /** 'wordnet' (default) or 'wiktionary'. */
  source?: string;
}
const POS = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb' } as const;
export const WIKTIONARY_PROVENANCE = { source: 'English Wiktionary (Wikimedia contributors), extracted by Wiktextract / kaikki.org', licence: 'CC BY-SA 4.0 (attribution and share-alike apply)', status: 'dictionary-source', updated: '2026-09-26', tier: 'dictionary' } as const;
export const WORDNET_PROVENANCE = { source: 'Open English WordNet 2025 (McCrae et al.) + CMU Pronouncing Dictionary', licence: 'CC BY 4.0 (WordNet); CMUdict unrestricted, acknowledged', status: 'dictionary-source', updated: '2025-12-31', tier: 'dictionary' } as const;

/**
 * Facts only. Nothing is invented: no difficulty claim beyond a neutral default, no register, no usage advice,
 * no practice. Those arrive later through validated enrichment, or not at all.
 */
export function rowToSense(r: DictRow): Sense {
  return {
    senseId: r.sense_id, lemma: r.lemma, lang: 'en', pos: POS[r.pos], contentVersion: 1, difficulty: 3,
    definition: r.definition, simple: r.definition,
    pronunciation: { text: r.ipa ?? '', syllables: [r.lemma], audioUrl: null },
    explanations: {},
    examples: r.examples.map((text, i) => ({ text, context: `WordNet example ${i + 1}` })),
    collocations: [], relatedForms: [], grammar: [],
    nearSynonyms: r.synonyms.map(lemma => ({ lemma, distinction: '' })),   // WordNet lists them as similar; it does not explain differences
    antonyms: r.antonyms, register: 'neutral', suitableSituations: [], unsuitableUses: [], prerequisites: [], related: [], practice: [],
    provenance: { ...(r.source === 'wiktionary' ? WIKTIONARY_PROVENANCE : WORDNET_PROVENANCE) },
  };
}

/**
 * Candidate dictionary forms for a typed word, most literal first. This is NOT a stemmer: it only proposes forms and the
 * database decides which exist. Irregular forms (went, mice) are not covered and stay honestly unknown.
 */
export function candidateLemmas(w: string): string[] {
  const out = [w];
  const add = (x: string) => { if (x.length >= 2 && !out.includes(x)) out.push(x); };
  if (w.endsWith('ies')) add(w.slice(0, -3) + 'y');
  if (w.endsWith('ied')) add(w.slice(0, -3) + 'y');
  if (w.endsWith('es')) add(w.slice(0, -2));
  if (w.endsWith('s') && !w.endsWith('ss')) add(w.slice(0, -1));
  if (w.endsWith('ed')) { add(w.slice(0, -2)); add(w.slice(0, -1)); const b = w.slice(0, -2); if (/(.)\1$/.test(b)) add(b.slice(0, -1)); }
  if (w.endsWith('ing')) { const b = w.slice(0, -3); add(b); add(b + 'e'); if (/(.)\1$/.test(b)) add(b.slice(0, -1)); }
  if (w.endsWith('ly')) add(w.slice(0, -2));
  if (w.endsWith('er')) { add(w.slice(0, -2)); add(w.slice(0, -1)); }
  if (w.endsWith('est')) { add(w.slice(0, -3)); add(w.slice(0, -2)); }
  return out;
}
