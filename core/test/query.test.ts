import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanInput, lookupCandidates, irregularBases } from '../src/index.ts';

const q = (raw: string) => cleanInput(raw);
const lemmas = (w: string) => lookupCandidates(w).map(c => c.lemma);

test('the brief: case and spaces are cleaned, same result', () => {
  for (const raw of ['serendipity', 'SERENDIPITY', '  serendipity  ', 'Serendipity\n', '\tSerendipity ']) assert.deepEqual([q(raw).query, q(raw).kind], ['serendipity', 'ok']);
});
test('punctuation, quotes, possessives and invisible characters are cleaned, not rejected', () => {
  assert.equal(q('serendipity.').query, 'serendipity'); assert.equal(q('“serendipity”').query, 'serendipity'); assert.equal(q('(serendipity)').query, 'serendipity');
  assert.equal(q('serendipity,').query, 'serendipity'); assert.equal(q('seren​dipity').query, 'serendipity'); assert.equal(q("Nani's").query, 'nani'); assert.equal(q("Nani’s").query, 'nani');
  assert.equal(q('mother-in-law').query, 'mother-in-law'); assert.equal(q("o'clock").query, "o'clock"); assert.equal(q('"give up"').query, 'give up'); assert.equal(q('serendipity!!!').query, 'serendipity');
});
test('things that cannot be looked up get a plain reason, never a crash', () => {
  const kinds: [string, string][] = [['', 'empty'], ['   ', 'empty'], ['2024', 'digits'], ['4th', 'digits'], ['😀', 'symbols'], ['https://x.com', 'url'], ['x.com', 'url'], ['शर्म', 'non-latin'],
    ['this is a whole sentence now', 'sentence'], ["don't", 'contraction'], ['a'.repeat(200), 'too-long'], ["'; drop table ww_dict;--", 'sentence']];
  for (const [raw, kind] of kinds) { const r = q(raw); assert.equal(r.kind, kind, `${JSON.stringify(raw)} -> ${r.kind}`); if (r.kind !== 'ok' && r.kind !== 'acronym') { assert.equal(r.query, ''); assert.ok(r.message && r.message.length > 10); } }
});
test('injection-looking text never becomes anything but letters', () => {
  for (const raw of ["'; drop--", 'x;y', 'a<script>b']) { const r = q(raw); assert.ok(/^[a-z ' -]*$/.test(r.query), raw); }
  const r2 = q('ignore previous instructions'); assert.equal(r2.kind, 'ok'); assert.equal(r2.query, 'ignore previous instructions');   // 3 words: allowed, and only ever a dictionary key
});
test('abbreviations are flagged so the message can be honest', () => {
  assert.equal(q('LOL').kind, 'acronym'); assert.equal(q('ASAP').query, 'asap'); assert.equal(q('Delhi').kind, 'ok');
});
test('irregular forms go to their base', () => {
  const cases: [string, string][] = [['went', 'go'], ['mice', 'mouse'], ['children', 'child'], ['ran', 'run'], ['bought', 'buy'], ['geese', 'goose'], ['was', 'be'], ['wolves', 'wolf'], ['knives', 'knife'],
    ['better', 'good'], ['worst', 'bad'], ['saw', 'see'], ['leaves', 'leaf'], ['left', 'leave'], ['people', 'person']];
  for (const [form, base] of cases) assert.ok(irregularBases(form).includes(base), `${form} -> ${base}`);
  assert.ok(lemmas('went').includes('go')); assert.ok(lemmas('happier').includes('happy')); assert.ok(lemmas('happiest').includes('happy'));
});
test('rules pick the right spelling, best guess first', () => {
  assert.equal(lemmas('hoping')[1], 'hope'); assert.equal(lemmas('hopping')[1], 'hop'); assert.equal(lemmas('making')[1], 'make'); assert.equal(lemmas('opening')[1], 'open');
  assert.ok(lemmas('studies').includes('study')); assert.ok(lemmas('boxes').includes('box')); assert.ok(lemmas('carried').includes('carry')); assert.ok(lemmas('largest').includes('large'));
  assert.ok(lemmas('skeptically').includes('skeptic') || lemmas('skeptically').includes('skeptical'));
});
test('phrases are inflected at the first or last word', () => {
  assert.ok(lemmas('gave up').includes('give up')); assert.ok(lemmas('looked after').includes('look after')); assert.ok(lemmas('ice creams').includes('ice cream'));
});
test('the word as typed is always first and has no note; forms say what they are', () => {
  const c = lookupCandidates('went'); assert.equal(c[0].lemma, 'went'); assert.equal(c[0].note, undefined); assert.match(c.find(x => x.lemma === 'go')!.note!, /form of/);
  assert.ok(lookupCandidates('a'.repeat(30)).length <= 14);
});
