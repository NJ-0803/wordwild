import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState, capture, submitAttempt, DAY } from '../src/index.ts';
import { RATING_LABEL, ratingAttempt, reviewQueue, reviewSummary } from '../src/review.ts';
import { SENSE_BY_ID } from '../src/index.ts';

const ids = Object.keys(SENSE_BY_ID).slice(0, 4);
function withWords(n: number, now: number) {
  let s = freshState();
  for (const id of ids.slice(0, n)) s = capture(s, { status: 'found', senses: [SENSE_BY_ID[id]], source: 'test' }, { now, senseId: id }).state;
  return s;
}

test('queue: ripe words oldest first, then one new word', () => {
  const t0 = 1_700_000_000_000;
  let s = withWords(3, t0);
  s = submitAttempt(s, ratingAttempt(ids[0], 'know', 'a', t0 + 1000)).state;
  s = submitAttempt(s, ratingAttempt(ids[1], 'know', 'b', t0 + 2000)).state;
  assert.deepEqual(reviewQueue(s, t0 + 3000), [ids[2]], 'nothing ripe yet: only the new word');
  const later = t0 + 3 * DAY;
  const q = reviewQueue(s, later);
  assert.equal(q.length, 3); assert.deepEqual(q.slice(0, 2), [ids[0], ids[1]]); assert.equal(q[2], ids[2]);
});

test('queue is capped and empty when nothing to do', () => {
  assert.deepEqual(reviewQueue(freshState(), Date.now()), []);
  assert.ok(reviewQueue(withWords(4, 1_700_000_000_000), 1_700_000_000_000 + DAY, 2).length <= 2);
});

test('ratings map to honest evidence', () => {
  assert.equal(ratingAttempt('x', 'know', 'k', 1).correct, true); assert.equal(ratingAttempt('x', 'know', 'k', 1).hintsUsed, 0);
  assert.equal(ratingAttempt('x', 'almost', 'k', 1).hintsUsed, 1);
  assert.equal(ratingAttempt('x', 'forgot', 'k', 1).correct, false);
  assert.equal(RATING_LABEL.forgot, 'I forgot');
});

test('a forgotten word is due sooner than a known one; self-review alone never makes it secure', () => {
  const t0 = 1_700_000_000_000; const s0 = withWords(2, t0);
  let s = s0;
  for (let i = 0; i < 6; i++) s = submitAttempt(s, ratingAttempt(ids[0], 'know', `k${i}`, t0 + (i + 1) * 30 * DAY)).state;
  assert.notEqual(s.senses[ids[0]].evidence.recall?.distinctActivities.length, 2);
  const a = submitAttempt(s0, ratingAttempt(ids[1], 'know', 'x', t0 + 10)).state.senses[ids[1]].due;
  const b = submitAttempt(s0, ratingAttempt(ids[1], 'forgot', 'y', t0 + 10)).state.senses[ids[1]].due;
  assert.ok(b <= a);
});

test('summary wording is kind', () => {
  assert.equal(reviewSummary([]).total, 0);
  assert.match(reviewSummary(['know', 'know']).headline, /came back/);
  assert.match(reviewSummary(['forgot']).headline, /sooner/);
  assert.equal(reviewSummary(['know', 'almost', 'forgot']).almost, 1);
});
