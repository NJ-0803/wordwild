import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState, capture, townView, levelFromXp, xpToReach, safeLookup, FixtureProvider, DAY, DAILY_DISCOVERY_CAP, WELCOME_POINTS, WELCOME_BACK_DAYS, BUILDINGS } from '../src/index.ts';
import type { LearnerState } from '../src/index.ts';

const T0 = 1_800_000_000_000;
const save = async (s: LearnerState, w: string, at: number) => capture(s, await safeLookup(new FixtureProvider(), w, 1000), { now: at, senseId: undefined }).state;
const pts = (s: LearnerState, k: string) => s.rewards.filter(r => r.kind === k).reduce((n, r) => n + r.points, 0);

test('levels only rise, and each asks a little more than the last', () => {
  let prev = -1; for (let xp = 0; xp < 2000; xp += 7) { const l = levelFromXp(xp).level; assert.ok(l >= prev); prev = l; }
  const steps = [1, 2, 3, 4, 5].map(l => xpToReach(l + 1) - xpToReach(l));
  assert.deepEqual(steps, [50, 60, 70, 80, 90]);
  const v = levelFromXp(xpToReach(3) - 1); assert.equal(v.level, 2); assert.equal(v.next, 1);
});
test('the whole town is reachable at a sane pace (about 10 mastered words for the last building)', () => {
  const last = BUILDINGS[BUILDINGS.length - 1]; const xp = xpToReach(last.unlockLevel);
  assert.ok(xp / 55 <= 12, `level ${last.unlockLevel} needs ${xp} xp = ${(xp / 55).toFixed(1)} words`);
});
test('saving words pays only up to the daily cap; the word is still saved', async () => {
  const near = { ...freshState(), lastClock: T0, rewards: [{ key: 'seed', kind: 'discovery' as const, points: DAILY_DISCOVERY_CAP - 2, at: T0 }] };
  const s = await save(near, 'polite', T0 + 1000);
  assert.ok(s.senses['polite.adj.1']); assert.equal(pts(s, 'discovery'), DAILY_DISCOVERY_CAP);          // only 2 of the 5 was paid
  const s2 = await save(s, 'blunt', T0 + 2000); assert.ok(s2.senses['blunt.adj.1']); assert.equal(pts(s2, 'discovery'), DAILY_DISCOVERY_CAP);
  const tomorrow = await save(s2, 'tactful', T0 + DAY + 1000); assert.ok(pts(tomorrow, 'discovery') > DAILY_DISCOVERY_CAP);   // cap resets daily
});
test('coming back after a break earns a gift, never a penalty; short gaps earn nothing', async () => {
  let s = await save(freshState(), 'polite', T0);
  const before = townView(s, T0).coins;
  const soon = await save(s, 'blunt', T0 + DAY); assert.equal(pts(soon, 'welcome'), 0);
  const back = await save(s, 'blunt', T0 + (WELCOME_BACK_DAYS + 1) * DAY);
  assert.equal(pts(back, 'welcome'), WELCOME_POINTS);
  assert.ok(townView(back, T0 + 10 * DAY).coins >= before + WELCOME_POINTS);
  assert.equal(townView(back, T0 + 10 * DAY).level >= townView(s, T0).level, true);   // level never drops
});
