import test from 'node:test';
import assert from 'node:assert/strict';
import { editDistance, estimateLevel, sanitizeProfile, selectConstellation, heuristicLevel, sanitizePrefs, relativeLabel, type Candidate, type LearnerProfile, type Role } from '../src/index.ts';

const prof = (over: Partial<LearnerProfile> = {}): LearnerProfile => ({ interests: [], updatedAt: 1, ...over });
const cand = (lemma: string, role: Role, level: number, topics: string[] = []): Candidate =>
  ({ lemma, senseId: `${lemma}%1:00:00::`, pos: 'adjective', role, level, topics, simple: `meaning of ${lemma}`, source: 'wordnet' });

test('no profile: a friendly middle-low start and it says so', () => {
  const e = estimateLevel(undefined, []);
  assert.equal(e.level, 2.0); assert.equal(e.certainty, 'low'); assert.match(e.factors[0], /do not know you yet/);
});
test('reading comfort is the main signal; schooling is ignored when comfort is known', () => {
  assert.equal(estimateLevel(prof({ readingComfort: 1, schooling: 'advanced' }), []).level, 1.3);
  assert.equal(estimateLevel(prof({ readingComfort: 4, schooling: 'none-little' }), []).level, 4.0);
});
test('low schooling never caps a strong reader; age never changes level', () => {
  const strong = estimateLevel(prof({ readingComfort: 3, schooling: 'none-little', ageBand: '30-49' }), []);
  assert.equal(strong.level, 3.1);
  assert.equal(estimateLevel(prof({ readingComfort: 2, ageBand: '50+' }), []).level, estimateLevel(prof({ readingComfort: 2, ageBand: '18-29' }), []).level);
});
test('schooling is only a weak prior when comfort is unknown (an adult with little schooling is not treated as a child)', () => {
  const e = estimateLevel(prof({ schooling: 'none-little', ageBand: '30-49' }), []);
  assert.equal(e.level, 1.5); assert.equal(e.tone, 'adult');
  assert.equal(estimateLevel(prof({ ageBand: '13-17' }), []).tone, 'child-friendly');
});
test('real evidence outweighs what they told us, gradually, and looking up hard words is not evidence', () => {
  const told = prof({ readingComfort: 1 });
  const few = estimateLevel(told, [3.5]).level, many = estimateLevel(told, Array(10).fill(3.5)).level;
  assert.ok(few > 1.3 && few < many, 'more evidence moves the level further'); assert.ok(many <= 3.5);
  assert.equal(estimateLevel(told, []).level, 1.3, 'with no practised words the level does not move (lookups are not passed in at all)');
  assert.equal(estimateLevel(told, Array(10).fill(3.5)).certainty, 'high');
});
test('profile sanitiser drops unknown values and caps interests', () => {
  const p = sanitizeProfile({ readingComfort: 9, interests: ['cricket', 'evil', 'cooking', 'movies', 'music', 'farming', 'business', 'health'], purpose: 'x', ageBand: 'old', schooling: 'phd', updatedAt: 5 })!;
  assert.equal(p.readingComfort, undefined); assert.equal(p.interests.length, 6); assert.ok(!p.interests.includes('evil')); assert.equal(p.purpose, undefined); assert.equal(p.ageBand, undefined); assert.equal(p.schooling, undefined);
  assert.equal(sanitizeProfile(null), undefined);
  const ok = sanitizePrefs({ explainLang: 'hi', textScale: 1, profile: { readingComfort: 2, interests: ['cricket'], updatedAt: 1 } });
  assert.equal(ok?.profile?.readingComfort, 2);
});

const POOL: Candidate[] = [
  cand('doubtful', 'same-meaning', 2.0), cand('cynical', 'stronger', 3.6), cand('wary', 'gentler', 2.4), cand('trusting', 'opposite', 1.8),
  cand('convinced', 'opposite', 3.0), cand('suspicious', 'used-together', 2.6), cand('doubt', 'easier-bridge', 1.4), cand('sceptical', 'same-meaning', 3.9),
  cand('incredulous', 'stronger', 4.6), cand('proof', 'used-together', 1.6, ['news']), cand('evidence', 'same-situation', 2.5), cand('gullible', 'opposite', 3.4),
];

test('selects 5 for a beginner and 6 for a fluent reader, easiest first, with reasons', () => {
  const b = selectConstellation({ target: { lemma: 'skeptical', level: 3.4 }, learner: { level: 1.8, interests: [] }, candidates: POOL, known: new Set() });
  assert.equal(b.length, 5); assert.ok(b.every(p => p.why.length > 20));
  assert.deepEqual(b.map(p => p.level), [...b.map(p => p.level)].sort((x, y) => x - y));
  const f = selectConstellation({ target: { lemma: 'skeptical', level: 3.4 }, learner: { level: 3.5, interests: [] }, candidates: POOL, known: new Set() });
  assert.equal(f.length, 6);
});
test('a beginner is never handed words far above them; they get an easier stepping stone and an opposite', () => {
  const b = selectConstellation({ target: { lemma: 'skeptical', level: 3.6 }, learner: { level: 1.5, interests: [] }, candidates: POOL, known: new Set() });
  assert.ok(b.every(p => p.level <= 1.5 + 2.2), 'nothing far too hard');
  assert.ok(!b.some(p => p.lemma === 'incredulous'));
  assert.ok(b.some(p => p.role === 'easier-bridge'), 'bridge included because the asked word is far above the learner');
  assert.ok(b.some(p => p.role === 'opposite'), 'an opposite is always included when available');
});
test('an advanced learner gets stretch words instead of the easy bridge', () => {
  const f = selectConstellation({ target: { lemma: 'skeptical', level: 3.4 }, learner: { level: 4.0, interests: [] }, candidates: POOL, known: new Set() });
  assert.ok(f.some(p => p.lemma === 'incredulous' || p.lemma === 'cynical'));
  assert.ok(!f.some(p => p.role === 'easier-bridge'), 'target is not far above the learner: no bridge forced');
});
test('never suggests the word itself or words the learner already saved; at most 2 of a kind; no duplicates', () => {
  const dup = [...POOL, cand('skeptical', 'same-meaning', 3.4), cand('doubtful', 'same-meaning', 2.0)];
  const p = selectConstellation({ target: { lemma: 'skeptical', level: 3.4 }, learner: { level: 3.0, interests: [] }, candidates: dup, known: new Set(['wary', 'cynical']) });
  assert.ok(!p.some(x => x.lemma === 'skeptical' || x.lemma === 'wary' || x.lemma === 'cynical'));
  assert.equal(new Set(p.map(x => x.lemma)).size, p.length);
  const counts: Record<string, number> = {}; p.forEach(x => { counts[x.role] = (counts[x.role] ?? 0) + 1; });
  assert.ok(Object.values(counts).every(n => n <= 2));
});
test('interests and purpose gently break ties; they never override level', () => {
  const pool = [cand('alpha', 'used-together', 2.6, ['cricket']), cand('beta', 'used-together', 2.6, []), cand('gamma', 'same-situation', 2.6, [])];
  const withI = selectConstellation({ target: { lemma: 'x', level: 2 }, learner: { level: 2.0, interests: ['cricket'] }, candidates: pool, known: new Set(), size: 1 });
  assert.equal(withI[0].lemma, 'alpha');
  const hard = [cand('cricketword', 'used-together', 5, ['cricket']), cand('plain', 'used-together', 2.6, [])];
  const r = selectConstellation({ target: { lemma: 'x', level: 2 }, learner: { level: 1.5, interests: ['cricket'] }, candidates: hard, known: new Set(), size: 1 });
  assert.equal(r[0].lemma, 'plain', 'a topic match does not justify a word far above the learner');
});
test('deterministic: same inputs, same words and order', () => {
  const a = selectConstellation({ target: { lemma: 'skeptical', level: 3.4 }, learner: { level: 2.2, interests: ['news'] }, candidates: POOL, known: new Set() });
  const b = selectConstellation({ target: { lemma: 'skeptical', level: 3.4 }, learner: { level: 2.2, interests: ['news'] }, candidates: [...POOL].reverse(), known: new Set() });
  assert.deepEqual(a.map(x => x.lemma), b.map(x => x.lemma));
});
test('too few candidates returns what exists, not padding', () => {
  assert.equal(selectConstellation({ target: { lemma: 'x', level: 2 }, learner: { level: 2, interests: [] }, candidates: POOL.slice(0, 2), known: new Set() }).length, 2);
  assert.deepEqual(selectConstellation({ target: { lemma: 'x', level: 2 }, learner: { level: 2, interests: [] }, candidates: [], known: new Set() }), []);
});
test('relative labels compare the word with the reader, never call a word hard in itself; heuristic is bounded', () => {
  assert.equal(relativeLabel(1.5, 3), 'an easier word'); assert.equal(relativeLabel(3.2, 3), 'at your level'); assert.equal(relativeLabel(4.5, 3), 'a small stretch');
  for (const w of ['a', 'cat', 'serendipity', 'internationalization']) { const l = heuristicLevel(w, 1, false); assert.ok(l >= 1 && l <= 5); }
  assert.ok(heuristicLevel('internationalization', 1, false) > heuristicLevel('cat', 4, true));
});

test('two candidates with the identical definition never both appear', () => {
  const a = { ...cand('doubting', 'same-meaning', 2.0), simple: 'marked by doubt' }, b = { ...cand('questioning', 'same-meaning', 2.0), simple: 'marked by doubt' };
  const c = { ...cand('wary', 'gentler', 2.2), simple: 'careful about danger' };
  const r = selectConstellation({ target: { lemma: 'x', level: 2 }, learner: { level: 1.8, interests: [] }, candidates: [a, b, c], known: new Set() });
  assert.equal(r.filter(p => p.simple === 'marked by doubt').length, 1); assert.equal(r.length, 2);
});

test('spelling variants are not offered as "nearly the same" words', () => {
  assert.equal(editDistance('skeptical', 'sceptical'), 1); assert.equal(editDistance('kitten', 'sitting'), 3);
  const r = selectConstellation({ target: { lemma: 'skeptical', level: 3 }, learner: { level: 3, interests: [] }, known: new Set(), candidates: [cand('sceptical', 'same-meaning', 3), cand('doubting', 'same-meaning', 2.5)] });
  assert.deepEqual(r.map(p => p.lemma), ['doubting']);
  const fam = selectConstellation({ target: { lemma: 'skeptical', level: 3 }, learner: { level: 3, interests: [] }, known: new Set(), candidates: [cand('skeptic', 'same-family', 3)] });
  assert.equal(fam.length, 1, 'related family words with a small spelling difference are still fine');
});
