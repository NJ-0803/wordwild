import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FixtureProvider, safeLookup, freshState, capture, submitAttempt, exportEvents, mergeEvents, rebuildState, sanitizeEvents, sanitizePrefs,
  masteryLevel, DAY, type LearnerState, type Attempt,
} from '../src/index.ts';

const P = new FixtureProvider(); const T0 = 1_800_000_000_000;
const cap = async (s: LearnerState, q: string, at = T0, o: any = {}) => capture(s, await safeLookup(P, q), { now: at, context: 'private note', ...o }).state;
const att = (over: Partial<Attempt> = {}): Attempt => ({ key: 'k1', senseId: 'euphemism.n.1', activityId: 'eu-1', skill: 'meaning', correct: true, hintsUsed: 0, errorType: null, at: T0 + 1000, ...over });
const view = (s: LearnerState) => ({ senses: s.senses, rewards: s.rewards.map(r => `${r.key}:${r.points}`).sort(), captures: s.captures.map(c => c.query + '/' + c.senseId), attempts: Object.keys(s.attempts).sort() });

test('rebuild(export(state)) reproduces the same learning state', async () => {
  let s = await cap(freshState(), 'euphemism');
  s = submitAttempt(s, att({ key: 'a' })).state;
  s = submitAttempt(s, att({ key: 'b', at: T0 + 2 * DAY, skill: 'usage', activityId: 'eu-2' })).state;
  s = await cap(s, 'zzyzx', T0 + 5);
  assert.deepEqual(view(rebuildState(exportEvents(s), s.prefs)), view(s));
});
test('two devices working offline merge to one identical state, in any order, without double rewards', async () => {
  const base = await cap(freshState(), 'euphemism');
  let A = submitAttempt(base, att({ key: 'A1', at: T0 + 10 })).state;
  let B = await cap(base, 'polite', T0 + 20);
  B = submitAttempt(B, att({ key: 'B1', senseId: 'polite.adj.1', activityId: 'po-1', at: T0 + 30 })).state;
  A = submitAttempt(A, att({ key: 'A2', at: T0 + 2 * DAY, skill: 'usage', activityId: 'eu-2' })).state;
  const ab = rebuildState(mergeEvents(exportEvents(A), exportEvents(B)));
  const ba = rebuildState(mergeEvents(exportEvents(B), exportEvents(A)));
  assert.deepEqual(view(ab), view(ba));
  assert.equal(Object.keys(ab.senses).length, 2);
  assert.equal(ab.rewards.filter(r => r.key === 'discovery:euphemism.n.1').length, 1);
  assert.equal(Object.keys(ab.attempts).length, 3);
});
test('merging the same events twice changes nothing (retries are safe)', async () => {
  let s = await cap(freshState(), 'euphemism'); s = submitAttempt(s, att()).state;
  const e = exportEvents(s);
  assert.deepEqual(view(rebuildState(mergeEvents(e, e))), view(rebuildState(e)));
});
test('a pending capture is superseded once the word resolves elsewhere', async () => {
  const pending = await cap(freshState(), 'euphemism', T0, { });   // resolved here
  const asPending = { captures: [{ query: 'euphemism', senseId: null, context: '', source: 'x', at: T0 - 5, status: 'pending' as const }], attempts: [] };
  const m = mergeEvents(exportEvents(pending), asPending);
  assert.equal(m.captures.length, 1); assert.ok(m.captures[0].senseId);
});
test('rebuild skips unknown senses and attempts without a capture instead of inventing anything', () => {
  const s = rebuildState({ captures: [{ query: 'ghost', senseId: 'ghost.n.9', context: '', source: '', at: T0, status: 'resolved' }], attempts: [att()] });
  assert.equal(Object.keys(s.senses).length, 0); assert.equal(Object.keys(s.attempts).length, 0);
});
test('server-side validation drops malformed, oversized and forged events', () => {
  const good = { key: 'ok', senseId: 'euphemism.n.1', activityId: 'eu-1', skill: 'meaning', correct: true, hintsUsed: 0, errorType: null, at: T0 };
  const e = sanitizeEvents({
    attempts: [good, { ...good, key: '' }, { ...good, key: 'x', skill: 'hax' }, { ...good, key: 'y', senseId: 'nope.n.1' }, { ...good, key: 'z', hintsUsed: -1 },
      { ...good, key: 'w', correct: 'yes' }, { ...good, key: 'v'.repeat(500) }, { ...good, key: 'u', at: NaN }],
    captures: [{ query: 'euphemism', senseId: 'euphemism.n.1', context: 'ok', source: 's', at: T0, status: 'resolved' },
      { query: 'x'.repeat(100), senseId: null, context: '', source: '', at: T0, status: 'pending' },
      { query: 'a', senseId: 'fake.n.1', context: '', source: '', at: T0, status: 'resolved' },
      { query: 'b', senseId: null, context: 'c'.repeat(501), source: '', at: T0, status: 'pending' }],
  });
  assert.equal(e.attempts.length, 1); assert.equal(e.captures.length, 1);
  assert.deepEqual(sanitizeEvents(null), { captures: [], attempts: [], town: [] });
  assert.equal(sanitizeEvents({ attempts: Array.from({ length: 900 }, (_, i) => ({ ...good, key: 'k' + i })) }).attempts.length, 500);
  assert.equal(sanitizePrefs({ explainLang: 'hi', textScale: 9 }), null);
  assert.ok(sanitizePrefs({ explainLang: 'hi', textScale: 1.25, reducedMotion: true }));
});
test('mastery reached on one device shows on the other after sync', async () => {
  let A = await cap(freshState(), 'euphemism');
  A = submitAttempt(A, att({ key: '1', skill: 'meaning', activityId: 'eu-1' })).state;
  A = submitAttempt(A, att({ key: '2', at: T0 + 2000, skill: 'usage', activityId: 'eu-2' })).state;
  A = submitAttempt(A, att({ key: '3', at: T0 + 2 * DAY, skill: 'usage', activityId: 'eu-5' })).state;
  const B = rebuildState(exportEvents(A));
  assert.equal(masteryLevel(B.senses['euphemism.n.1']), 'secure');
});
