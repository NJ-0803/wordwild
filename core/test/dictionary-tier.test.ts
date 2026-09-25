import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSense, isSenseId, tierOf, sanitizeEvents, rebuildState, freshState, capture, exportEvents, type Sense } from '../src/index.ts';

const dictSense = (over: Partial<Sense> = {}): Sense => ({
  senseId: 'skeptical%5:00:00:distrustful:00', lemma: 'skeptical', lang: 'en', pos: 'adjective', contentVersion: 1, difficulty: 3,
  definition: 'marked by or given to doubt', simple: 'marked by or given to doubt',
  pronunciation: { text: 'ˈskeptɪkəl', syllables: ['skeptical'], audioUrl: null }, explanations: {},
  examples: [{ text: 'a skeptical attitude', context: 'wordnet' }], collocations: [], relatedForms: [], grammar: [],
  nearSynonyms: [], antonyms: [], register: 'neutral', suitableSituations: [], unsuitableUses: [], prerequisites: [], related: [], practice: [],
  provenance: { source: 'Open English WordNet 2025', licence: 'CC BY 4.0', status: 'dictionary-source', updated: '2025-12-31', tier: 'dictionary' }, ...over,
});

test('sense id formats: fixture ids and WordNet sense keys accepted, junk rejected', () => {
  for (const ok of ['euphemism.n.1', 'skeptical%5:00:00:distrustful:00', 'serendipity%1:19:00::', "let go%2:41:00::", "ne'er-do-well%1:18:00::"]) assert.ok(isSenseId(ok), ok);
  for (const bad of ['', 'x', "'; drop table--", 'a%9:00:00::', 'skeptical%5:00:00', 'a'.repeat(200) + '%1:00:00::', 42, null, '../etc']) assert.ok(!isSenseId(bad), String(bad));
});
test('dictionary tier: facts-only sense is valid, but must still carry a definition and provenance', () => {
  assert.deepEqual(validateSense(dictSense()), []);
  assert.equal(tierOf(dictSense()), 'dictionary');
  assert.ok(validateSense(dictSense({ definition: '' })).length > 0);
  const noProv = dictSense(); noProv.provenance = { ...noProv.provenance, licence: '' };
  assert.ok(validateSense(noProv).length > 0);
});
test('a dictionary-tier label does NOT relax the rules for curated content', () => {
  const s = dictSense({ senseId: 'euphemism.n.1' }); s.provenance = { ...s.provenance, tier: undefined };   // curated by default
  assert.ok(validateSense(s).some(m => m.includes('3 examples')));
});
test('sync accepts dictionary sense ids and rebuilds them without a bundled catalogue', () => {
  const id = 'skeptical%5:00:00:distrustful:00';
  const ev = sanitizeEvents({
    captures: [{ query: 'skeptical', senseId: id, context: 'movie', source: 'Typed', at: 1_800_000_000_000, status: 'resolved' }],
    attempts: [{ key: 'a1', senseId: id, activityId: 'gen-1', skill: 'meaning', correct: true, hintsUsed: 0, errorType: null, at: 1_800_000_001_000 }],
  });
  assert.equal(ev.captures.length, 1); assert.equal(ev.attempts.length, 1);
  const s = rebuildState(ev);
  assert.ok(s.senses[id]); assert.equal(s.captures[0].context, 'movie');
  assert.equal(sanitizeEvents({ captures: [{ query: 'x', senseId: "x%5:00:00::'; --", context: '', source: '', at: 1, status: 'resolved' }] }).captures.length, 0);
});
test('capturing a dictionary sense works through the normal engine', () => {
  const r = capture(freshState(), { status: 'found', senses: [dictSense()], source: 'wordnet' }, { now: 1_800_000_000_000 });
  assert.equal(r.outcome, 'saved'); assert.equal(exportEvents(r.state).captures[0].senseId, 'skeptical%5:00:00:distrustful:00');
});

import { candidateLemmas, rowToSense } from '../src/index.ts';
test('candidate forms: literal first, plausible base forms after, no nonsense', () => {
  assert.deepEqual(candidateLemmas('skeptical'), ['skeptical']);
  assert.deepEqual(candidateLemmas('parties').slice(0, 2), ['parties', 'party']);
  assert.ok(candidateLemmas('stopped').includes('stop')); assert.ok(candidateLemmas('running').includes('run'));
  assert.ok(candidateLemmas('making').includes('make')); assert.ok(candidateLemmas('glasses').includes('glass'));
  assert.equal(candidateLemmas('a').length, 1);
});
test('rowToSense claims only what the dictionary says', () => {
  const s = rowToSense({ sense_id: 'skeptical%5:00:00:distrustful:00', lemma: 'skeptical', pos: 'adj', rank: 2, synset_id: '02473075-s', definition: 'marked by or given to doubt',
    examples: ['a skeptical attitude'], synonyms: ['doubting'], antonyms: [], broader: [], ipa: 'ˈskeptɪkəl', arpabet: null });
  assert.deepEqual(validateSense(s), []);
  assert.equal(s.provenance.tier, 'dictionary'); assert.equal(s.provenance.status, 'dictionary-source');
  assert.equal(s.practice.length, 0); assert.deepEqual(s.suitableSituations, []); assert.deepEqual(s.explanations, {});
  assert.equal(s.nearSynonyms[0].distinction, '');
});
