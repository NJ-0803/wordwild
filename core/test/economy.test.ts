import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState, capture, townView, safeLookup, FixtureProvider, DAY, DAILY_DISCOVERY_CAP, WELCOME_POINTS, WELCOME_BACK_DAYS, } from '../src/index.ts';
import type { LearnerState } from '../src/index.ts';

const T0 = 1_800_000_000_000;
const save = async (s: LearnerState, w: string, at: number) => capture(s, await safeLookup(new FixtureProvider(), w, 1000), { now: at, senseId: undefined }).state;
const pts = (s: LearnerState, k: string) => s.rewards.filter(r => r.kind === k).reduce((n, r) => n + r.points, 0);

test('saving words pays only up to the daily cap; the word is still saved', async () => {
  const near = { ...freshState(), lastClock: T0, rewards: [{ key: 'seed', kind: 'discovery' as const, points: DAILY_DISCOVERY_CAP - 2, at: T0 }] };
  const s = await save(near, 'polite', T0 + 1000);
  assert.ok(s.senses['polite.adj.1']); assert.equal(pts(s, 'discovery'), DAILY_DISCOVERY_CAP);          // only 2 of the 5 was paid
  const s2 = await save(s, 'blunt', T0 + 2000); assert.ok(s2.senses['blunt.adj.1']); assert.equal(pts(s2, 'discovery'), DAILY_DISCOVERY_CAP);
  const tomorrow = await save(s2, 'tactful', T0 + DAY + 1000); assert.ok(pts(tomorrow, 'discovery') > DAILY_DISCOVERY_CAP);   // cap resets daily
});
test('coming back after a break earns a gift, never a penalty; short gaps earn nothing', async () => {
  let s = await save(freshState(), 'polite', T0);
  const before = townView(s).points;
  const soon = await save(s, 'blunt', T0 + DAY); assert.equal(pts(soon, 'welcome'), 0);
  const back = await save(s, 'blunt', T0 + (WELCOME_BACK_DAYS + 1) * DAY);
  assert.equal(pts(back, 'welcome'), WELCOME_POINTS);
  assert.ok(townView(back).points >= before, 'the town never shrinks after a break');
});
