import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeMetric, sanitizeDevice, counts, deltaEvents, freshState, capture, safeLookup, FixtureProvider, METRIC_EVENTS } from '../src/index.ts';

test('only known events with known labels are accepted; free text is refused', () => {
  assert.deepEqual(sanitizeMetric({ name: 'app_open' }), { name: 'app_open' });
  assert.deepEqual(sanitizeMetric({ name: 'lookup', label: 'unknown-suggested' }), { name: 'lookup', label: 'unknown-suggested' });
  for (const bad of [null, 'x', {}, { name: 'lookup', label: 'serendipity' }, { name: 'word_saved', label: 'euphemism' }, { name: 'nope' }, { name: 'lookup', label: 5 }, { name: 'share_card', label: 'email me@x.com' }, { name: ['app_open'] }, { name: '__proto__' }])
    assert.equal(sanitizeMetric(bad), null, JSON.stringify(bad));
  assert.equal(METRIC_EVENTS.length, new Set(METRIC_EVENTS).size);
});
test('device ids are random tokens, not anything that identifies a person', () => {
  assert.equal(sanitizeDevice('a1b2c3d4e5f6a7b8c9d0'), 'a1b2c3d4e5f6a7b8c9d0');
  for (const bad of ['', 'me@x.com', 'A1B2C3D4E5F6A7B8C9D0', 'user_2abcdefghijklmnop', 'short', 'x'.repeat(41), 12, null]) assert.equal(sanitizeDevice(bad), null, String(bad));
});
test('events are read from what changed in the learner state, never from its content', async () => {
  const P = new FixtureProvider(); const a = counts(freshState());
  const s = capture(freshState(), await safeLookup(P, 'polite'), { now: 1 }).state; const b = counts(s);
  const ev = deltaEvents(a, b); assert.deepEqual(ev, [{ name: 'word_saved' }]);
  assert.deepEqual(deltaEvents(b, b), []); assert.deepEqual(deltaEvents(b, a), [], 'going down (a reset) reports nothing');
  assert.ok(deltaEvents(a, { saved: 50, practised: 0, secure: 0, scenes: 0 }).length <= 5, 'a big merge after sign-in cannot flood the counters');
  for (const e of ev) assert.equal(Object.keys(e).filter(k => k !== 'name').length, 0, 'no content fields');
});

import { firstWordBucket } from '../src/index.ts';
test('first-word timing buckets and the new recall events are on the allow-list', () => {
  assert.equal(firstWordBucket(12_000), 'lt30s'); assert.equal(firstWordBucket(45_000), 'lt60s'); assert.equal(firstWordBucket(100_000), 'lt3m'); assert.equal(firstWordBucket(900_000), 'slower');
  assert.deepEqual(sanitizeMetric({ name: 'first_word', label: 'lt30s' }), { name: 'first_word', label: 'lt30s' });
  assert.equal(sanitizeMetric({ name: 'first_word', label: 'serendipity' }), null, 'no free text');
  for (const n of ['first_review', 'review_done', 'recall_unassisted', 'recall_assisted', 'recall_forgot']) assert.deepEqual(sanitizeMetric({ name: n }), { name: n });
});
