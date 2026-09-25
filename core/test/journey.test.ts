import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FixtureProvider, SENSE_BY_ID, safeLookup, freshState, capture, submitAttempt, nextActivity, learningDays, milestones, dailyJourney, vault, DAY, finishScene } from '../src/index.ts';
import type { LearnerState } from '../src/index.ts';

const P = new FixtureProvider(); const T0 = 1_800_000_000_000; const TZ = 330;
const save = async (s: LearnerState, w: string, at: number) => capture(s, await safeLookup(P, w), { now: at }).state;
const practise = (s: LearnerState, id: string, at: number, correct = true) => {
  const act = nextActivity(s, SENSE_BY_ID[id], `t${at}`);
  return submitAttempt(s, { key: `${id}:${at}`, senseId: id, activityId: act.item.id, skill: act.item.skill, correct, hintsUsed: 0, errorType: null, at }).state;
};

test('learning days only ever go up, and missing days never removes anything', async () => {
  let s = await save(freshState(), 'polite', T0);
  s = await save(s, 'blunt', T0 + DAY); s = await save(s, 'tactful', T0 + 5 * DAY);
  const a = learningDays(s, T0 + 5 * DAY, TZ); assert.equal(a.total, 3);
  const later = learningDays(s, T0 + 60 * DAY, TZ); assert.equal(later.total, 3, 'still 3 after two months away');
  assert.equal(later.week.filter(d => d.learned).length, 0); assert.equal(later.inARow, 0);
  assert.ok(later.best >= 2);
});
test('"in a row" counts today or yesterday, so a day that has not happened yet never counts against you', async () => {
  let s = await save(freshState(), 'polite', T0); s = await save(s, 'blunt', T0 + DAY);
  assert.equal(learningDays(s, T0 + DAY + 3600_000, TZ).inARow, 2);        // same day as the last one
  assert.equal(learningDays(s, T0 + 2 * DAY + 3600_000, TZ).inARow, 2);     // the next morning: still 2, the day is not over
  assert.equal(learningDays(s, T0 + 3 * DAY + 3600_000, TZ).inARow, 0);
  const w = learningDays(s, T0 + DAY, TZ).week; assert.equal(w.length, 7); assert.ok(w[6].today);
});
test('milestones are derived, stay reached, and point at the next one', async () => {
  let s = freshState(); let m = milestones(s, T0, TZ); assert.equal(m.doneCount, 0); assert.equal(m.next?.id, 'first-word');
  s = await save(s, 'polite', T0); m = milestones(s, T0, TZ); assert.ok(m.all.find(x => x.id === 'first-word')!.done); assert.equal(m.next?.id, 'first-practice');
  s = practise(s, 'polite.adj.1', T0 + 1000); m = milestones(s, T0 + 1000, TZ); assert.ok(m.all.find(x => x.id === 'first-practice')!.done);
  const later = milestones(s, T0 + 90 * DAY, TZ); assert.ok(later.all.find(x => x.id === 'first-word')!.done, 'never lost');
  const sc = finishScene(s, 'home-tea', T0 + 2000); assert.ok(sc.ok && milestones(sc.state, T0 + 2000, TZ).all.find(x => x.id === 'first-scene')!.done);
  assert.ok(m.all.every(x => x.have <= x.need));
});
test('the daily journey is read from real events, not from taps', async () => {
  let s = freshState(); const fresh = [{ senseId: 'polite.adj.1', lemma: 'polite', from: '' }];
  let j = dailyJourney(s, T0, TZ, fresh); assert.equal(j.pick.kind, 'new'); assert.equal(j.doneCount, 0); assert.equal(j.complete, false);
  s = await save(s, 'polite', T0); j = dailyJourney(s, T0, TZ); assert.equal(j.pick.senseId, 'polite.adj.1'); assert.deepEqual(j.steps.map(x => x.done), [true, false, false]);
  s = practise(s, 'polite.adj.1', T0 + 1000); j = dailyJourney(s, T0 + 1000, TZ); assert.equal(j.steps[1].done, true);
  const next = dailyJourney(s, T0 + DAY, TZ, fresh); assert.equal(next.steps[1].done, false, 'a new day starts fresh; nothing is owed');
});
test('the vault puts every word in one group and schedules the week', async () => {
  let s = await save(freshState(), 'polite', T0); s = await save(s, 'blunt', T0); s = await save(s, 'tactful', T0);
  s = practise(s, 'polite.adj.1', T0 + 1000); s = practise(s, 'blunt.adj.1', T0 + 2000, false);
  const v = vault(s, T0 + 3000, TZ);
  const groups = [...v.review, ...v.fresh, ...v.learning, ...v.mastered]; assert.equal(new Set(groups).size, groups.length, 'no word in two groups'); assert.equal(groups.length, 3);
  assert.deepEqual(v.fresh, ['tactful.adj.1']); assert.ok(v.schedule.length === 7 && v.schedule.reduce((a, b) => a + b, 0) >= 2);
  const week = vault(s, T0 + 8 * DAY, TZ); assert.ok(week.review.length >= 2, 'due words are ripe, never lost');
  const withPending = capture(s, await safeLookup(P, 'zzyzx'), { now: T0 + 4000 }).state; assert.equal(vault(withPending, T0 + 5000, TZ).pending.length, 1);
});
