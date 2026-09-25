import type { Sense, ChoiceItem, PracticeItem, SenseTier } from './types.ts';

/** Fixture ids look like "euphemism.n.1"; dictionary ids are WordNet sense keys like "skeptical%5:00:00:doubting:00". */
const FIXTURE_ID = /^[a-z' -]+\.(n|v|adj|adv)\.\d+$/;
const WN_KEY = /^[\p{L}0-9'_. -]{1,60}%[1-5]:\d\d:\d\d:[\p{L}0-9'_. -]*:[0-9]*$/u;
export const isSenseId = (id: unknown): id is string => typeof id === 'string' && id.length <= 90 && (FIXTURE_ID.test(id) || WN_KEY.test(id));
export const tierOf = (s: Sense): SenseTier => s.provenance.tier ?? 'curated';

/** Returns a list of problems; empty means the sense is structurally acceptable. Does NOT prove accuracy. */
export function validateSense(s: Sense): string[] {
  const p: string[] = [];
  const need = (c: unknown, m: string) => { if (!c) p.push(`${s.senseId}: ${m}`); };
  need(isSenseId(s.senseId), 'senseId format lemma.pos.n or WordNet sense key');
  need(s.definition.trim() && s.simple.trim(), 'definition and simple explanation');
  need(s.provenance.source && s.provenance.licence && s.provenance.updated, 'provenance');
  if (tierOf(s) === 'dictionary') return p;      // facts only: no practice, examples or usage notes are claimed
  need(s.pronunciation.text && s.pronunciation.syllables.length > 0, 'pronunciation text + syllables');
  need(s.examples.length >= 3, 'at least 3 examples');
  need(new Set(s.examples.map(e => e.context)).size === s.examples.length, 'example contexts must be distinct');
  need(s.examples.every(e => e.text.trim().length > 0), 'examples non-empty');
  need(s.suitableSituations.length > 0, 'suitable situations');
  if (tierOf(s) === 'curated') need(s.unsuitableUses.length > 0, 'unsuitable or misleading uses (curated content must state them)');
  need(s.provenance.source && s.provenance.licence && s.provenance.updated, 'provenance');
  need(s.practice.length >= 3, 'at least 3 practice items');
  need(new Set(s.practice.map(i => i.kind)).size >= 2, 'practice must span at least 2 activity kinds');
  need(new Set(s.practice.map(i => i.id)).size === s.practice.length, 'practice ids unique');
  for (const i of s.practice) p.push(...validateItem(s.senseId, i));
  return p;
}

export function validateItem(owner: string, i: PracticeItem): string[] {
  const p: string[] = [];
  const need = (c: unknown, m: string) => { if (!c) p.push(`${owner}/${i.id}: ${m}`); };
  need(i.prompt.trim() && i.hint.trim(), 'prompt and hint');
  if (i.kind === 'explain-back') {
    need(i.concepts.length >= 2 && i.concepts.every(c => c.terms.length > 0), '>=2 concept groups with terms');
    need(i.modelAnswer.trim(), 'model answer');
    return p;
  }
  const c = i as ChoiceItem;
  need(c.options.length >= 3 && c.options.length <= 4, '3-4 options');
  need(new Set(c.options.map(o => o.id)).size === c.options.length, 'option ids unique');
  need(new Set(c.options.map(o => o.text.trim().toLowerCase())).size === c.options.length, 'option texts unique');
  need(c.options.filter(o => o.id === c.correctId).length === 1, 'exactly one correct option');
  need(c.explanation.trim(), 'explanation');
  need(c.options.filter(o => o.id !== c.correctId).every(o => o.why && o.why.trim()), 'each distractor needs a "why not"');
  if (c.kind === 'listen-and-find') need(c.spoken, 'listen-and-find needs spoken text');
  return p;
}
