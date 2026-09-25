import test from 'node:test';
import assert from 'node:assert/strict';
import { SENSES, validateSense, validateItem, safeLookup, FixtureProvider, type Sense, type DictionaryProvider } from '../src/index.ts';

test('every fixture sense passes validation', () => {
  for (const s of SENSES) assert.deepEqual(validateSense(s), [], s.senseId);
});
test('sense ids are unique and labelled as unreviewed fixtures', () => {
  assert.equal(new Set(SENSES.map(s => s.senseId)).size, SENSES.length);
  for (const s of SENSES) assert.equal(s.provenance.status, 'fixture-unreviewed');
});
test('prerequisites and related ids all exist', () => {
  const ids = new Set(SENSES.map(s => s.senseId));
  for (const s of SENSES) for (const r of [...s.prerequisites, ...s.related]) assert.ok(ids.has(r), `${s.senseId} -> ${r}`);
});
test('validator rejects ambiguous / malformed questions', () => {
  const s = structuredClone(SENSES[0]) as Sense;
  const q: any = s.practice.find(p => p.kind !== 'explain-back');
  q.options[1].text = q.options[0].text;                       // duplicate option text
  assert.ok(validateItem(s.senseId, q).some(m => m.includes('unique')));
  const q2: any = structuredClone(s.practice.find(p => p.kind === 'meaning-bridge'));
  q2.correctId = 'zzz';                                        // no correct answer
  assert.ok(validateItem(s.senseId, q2).some(m => m.includes('exactly one correct')));
  const q3: any = structuredClone(q2); q3.correctId = 'a'; q3.options[1].why = '';
  assert.ok(validateItem(s.senseId, q3).some(m => m.includes('why not')));
  const short = structuredClone(s); short.examples = short.examples.slice(0, 2);
  assert.ok(validateSense(short).some(m => m.includes('3 examples')));
});
test('lookup: found, ambiguous, unknown, invalid, provider failure, unverified content', async () => {
  const p = new FixtureProvider();
  const found = await safeLookup(p, '  Euphemism ');
  assert.equal(found.status, 'found');
  const amb = await safeLookup(p, 'fire');
  assert.ok(amb.status === 'found' && amb.senses.length === 2);
  assert.equal((await safeLookup(p, 'fired')).status, 'found');
  assert.equal((await safeLookup(p, 'zzyzx')).status, 'unknown');
  assert.equal((await safeLookup(p, '<script>')).status, 'pending');
  const down: DictionaryProvider = { name: 'down', lookup: async () => { throw new Error('boom'); } };
  const r = await safeLookup(down, 'euphemism');
  assert.ok(r.status === 'pending' && r.reason === 'provider-unavailable');
  const slow: DictionaryProvider = { name: 'slow', lookup: () => new Promise(() => {}) };
  const t = await safeLookup(slow, 'euphemism', 20);
  assert.ok(t.status === 'pending' && t.reason === 'provider-timeout');
  const bad = structuredClone(SENSES[0]) as Sense; bad.examples = [];
  const evil: DictionaryProvider = { name: 'evil', lookup: async () => [bad] };
  const u = await safeLookup(evil, 'euphemism');
  assert.ok(u.status === 'pending' && u.reason === 'unverified-content');
});
