import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FixtureProvider, safeLookup, freshState, capture, submitAttempt, townView, buildBuilding, claimOrder, ordersForDay, orderRef, BUILDINGS, DAY,
  exportEvents, mergeEvents, rebuildState, sanitizeEvents, restore, serialize, type LearnerState, type Attempt,
} from '../src/index.ts';

const P = new FixtureProvider(); const T0 = 1_800_000_000_000; const DAY0 = Math.floor(T0 / DAY);
const cap = async (s: LearnerState, q: string, at = T0, o: any = {}) => capture(s, await safeLookup(P, q), { now: at, ...o }).state;
const att = (over: Partial<Attempt> = {}): Attempt => ({ key: 'k1', senseId: 'euphemism.n.1', activityId: 'eu-1', skill: 'meaning', correct: true, hintsUsed: 0, errorType: null, at: T0 + 1000, ...over });
/** A learner who has really learned a word: secure after a spaced review. */
const secureWord = async (s: LearnerState, q: string, id: string, ids: [string, string, string], start = T0) => {
  s = await cap(s, q, start);
  s = submitAttempt(s, att({ key: id + 'a', senseId: id, activityId: ids[0], skill: 'meaning', at: start + 10 })).state;
  s = submitAttempt(s, att({ key: id + 'b', senseId: id, activityId: ids[1], skill: 'usage', at: start + 20 })).state;
  s = submitAttempt(s, att({ key: id + 'c', senseId: id, activityId: ids[2], skill: 'usage', at: start + 2 * DAY })).state;
  return s;
};

test('pacing: the first fully learned word levels you up and pays for the first building', async () => {
  const s = await secureWord(freshState(), 'euphemism', 'euphemism.n.1', ['eu-1', 'eu-2', 'eu-5']);
  const v = townView(s, T0 + 3 * DAY);
  assert.equal(v.level, 2); assert.ok(v.coins >= 40); assert.equal(v.buildings.find(b => b.id === 'market')!.status, 'ready');
});

test('a new town: level 1, no coins, home built, everything else locked or waiting', () => {
  const v = townView(freshState(), T0);
  assert.equal(v.level, 1); assert.equal(v.coins, 0); assert.equal(v.buildings.find(b => b.id === 'home')!.status, 'built');
  assert.ok(v.buildings.filter(b => b.id !== 'home').every(b => b.status === 'locked'));
  assert.equal(v.orders.length, 3); assert.equal(v.plots.length, 0);
});
test('coins and XP come only from the learning ledger; spamming captures and repeats earns nothing extra', async () => {
  let s = await cap(freshState(), 'euphemism');
  const before = townView(s, T0).coins; assert.equal(before, 5, 'discovery is worth 5');
  for (let i = 0; i < 20; i++) s = submitAttempt(s, att({ key: 'spam' + i, at: T0 + 100 + i, activityId: 'eu-' + (i % 3) })).state;
  assert.ok(townView(s, T0 + 5000).coins <= 5 + 10 + 30, 'repeated same-day answers cannot farm coins');
});
test('a saved word is a crop: it is ripe to harvest when due, and never dies', async () => {
  let s = await cap(freshState(), 'euphemism');
  assert.equal(townView(s, T0).plots[0].firstTime, true); assert.equal(townView(s, T0).ripeCount, 1, 'a fresh seed is ready for its first practice');
  s = submitAttempt(s, att()).state;
  assert.equal(townView(s, T0 + 5000).ripeCount, 0, 'resting until its next review');
  assert.equal(townView(s, T0 + 2 * DAY).ripeCount, 1, 'ripe again when the review is due');
  assert.equal(townView(s, T0 + 400 * DAY).plots.length, 1, 'a year of missed days removes nothing');
  assert.equal(townView(s, T0 + 400 * DAY).coins, townView(s, T0).coins, 'and costs nothing');
});
test('building needs the level and the coins, spends them once, and cannot be repeated', async () => {
  let s = freshState();
  assert.deepEqual(buildBuilding(s, 'market', T0), { ok: false, reason: 'locked' });
  s = await secureWord(s, 'euphemism', 'euphemism.n.1', ['eu-1', 'eu-2', 'eu-5']);
  s = await secureWord(s, 'polite', 'polite.adj.1', ['po-1', 'po-2', 'po-3'], T0 + 3000);
  const v = townView(s, T0 + 3 * DAY); assert.ok(v.level >= 2 && v.coins >= 40, `level ${v.level} coins ${v.coins}`);
  const r = buildBuilding(s, 'market', T0 + 3 * DAY); assert.ok(r.ok); if (!r.ok) return;
  const after = townView(r.state, T0 + 3 * DAY);
  assert.equal(after.coins, v.coins - 40); assert.equal(after.buildings.find(b => b.id === 'market')!.status, 'built'); assert.equal(after.xp, v.xp, 'spending coins never lowers XP or level');
  assert.deepEqual(buildBuilding(r.state, 'market', T0 + 3 * DAY), { ok: false, reason: 'already-built' });
  assert.deepEqual(buildBuilding(freshState(), 'nope', T0), { ok: false, reason: 'unknown-building' });
  const rich = { ...s, rewards: [...s.rewards, { key: 'x', kind: 'mastery' as const, points: 3000, at: T0 }] };
  assert.equal(buildBuilding(rich, 'library', T0 + 3 * DAY).ok, true);
  assert.deepEqual(buildBuilding({ ...s, rewards: s.rewards.slice(0, 1) }, 'market', T0), { ok: false, reason: 'locked' });
});
test('orders: three per day, same for everyone that day, measured from real events, claimable once', async () => {
  const a = ordersForDay(DAY0).map(o => o.id), b = ordersForDay(DAY0).map(o => o.id); assert.deepEqual(a, b); assert.equal(new Set(a).size, 3);
  assert.notDeepEqual(ordersForDay(DAY0).map(o => o.id), ordersForDay(DAY0 + 1).map(o => o.id) , 'orders change day to day (may rarely coincide; checked over several days below)');
  const sets = new Set(Array.from({ length: 10 }, (_, i) => ordersForDay(DAY0 + i).map(o => o.id).join())); assert.ok(sets.size > 3);
  // force a day where 'plant2' is offered
  const day = Array.from({ length: 30 }, (_, i) => DAY0 + i).find(d => ordersForDay(d).some(o => o.id === 'plant2'))!;
  const at = day * DAY + 3600_000; const ref = orderRef(day, 'plant2', 0);
  let s = await cap(freshState(), 'euphemism', at);
  assert.deepEqual(claimOrder(s, ref, at), { ok: false, reason: 'not-done' });
  s = await cap(s, 'polite', at + 10);
  const view = townView(s, at); const o = view.orders.find(x => x.id === 'plant2')!; assert.equal(o.progress, 2); assert.equal(o.done, true);
  const c = claimOrder(s, ref, at + 20); assert.ok(c.ok); if (!c.ok) return;
  const after = townView(c.state, at + 20); assert.equal(after.coins, view.coins + 12); assert.equal(after.xp, view.xp + 12);
  assert.deepEqual(claimOrder(c.state, ref, at + 30), { ok: false, reason: 'already-claimed' });
  assert.deepEqual(claimOrder(s, orderRef(day, 'plant2', 0).replace('plant2', 'bogus'), at), { ok: false, reason: 'bad-order' });
  const otherDay = orderRef(day + 100, 'plant2', 0); assert.equal(claimOrder(s, otherDay, at).ok === false, true, 'cannot claim an order that was not offered that day');
});
test('orders belong to their own day: yesterday\'s work does not fill today\'s order', async () => {
  const day = Array.from({ length: 40 }, (_, i) => DAY0 + i).find(d => ordersForDay(d).some(o => o.id === 'plant2') && ordersForDay(d + 1).some(o => o.id === 'plant2'));
  if (day === undefined) return;                                   // rare calendar alignment; the assertion below covers the general rule
  let s = await cap(freshState(), 'euphemism', day * DAY + 1000); s = await cap(s, 'polite', day * DAY + 2000);
  assert.equal(townView(s, (day + 1) * DAY + 5).orders.find(o => o.id === 'plant2')!.progress, 0);
});
test('town actions sync: build and claim survive export -> merge -> rebuild, forged ones are dropped', async () => {
  let s = await secureWord(freshState(), 'euphemism', 'euphemism.n.1', ['eu-1', 'eu-2', 'eu-5']);
  s = await secureWord(s, 'polite', 'polite.adj.1', ['po-1', 'po-2', 'po-3'], T0 + 3000);
  const b = buildBuilding(s, 'market', T0 + 3 * DAY); assert.ok(b.ok); if (!b.ok) return; s = b.state;
  const rebuilt = rebuildState(exportEvents(s));
  assert.deepEqual(rebuilt.town.map(t => t.key), ['build:market']); assert.equal(townView(rebuilt, T0 + 3 * DAY).coins, townView(s, T0 + 3 * DAY).coins);
  // two devices merging the same events change nothing
  const e = exportEvents(s); assert.deepEqual(rebuildState(mergeEvents(e, e)).town, rebuilt.town);
  // a client that forges a building it cannot afford: the rebuild ignores it
  const forged = { ...exportEvents(freshState()), town: [{ key: 'build:library', kind: 'build' as const, ref: 'library', at: T0 }] };
  assert.equal(rebuildState(forged).town.length, 0, 'unaffordable or locked builds are ignored');
  const clean = sanitizeEvents({ town: [{ key: 'build:market', kind: 'build', ref: 'market', at: 1 }, { key: 'build:zzz', kind: 'build', ref: 'zzz', at: 1 }, { key: 'wrong', kind: 'build', ref: 'market', at: 1 }, { key: 'claim:x', kind: 'claim', ref: 'x', at: 1 }, null] }).town!;
  assert.deepEqual(clean.map(t => t.key), ['build:market']);
});
test('old saves without a town still load; town persists through save and restore', async () => {
  const oldSave = JSON.stringify({ ...freshState(), town: undefined });
  assert.deepEqual(restore(oldSave).state.town, []);
  let s = await secureWord(freshState(), 'euphemism', 'euphemism.n.1', ['eu-1', 'eu-2', 'eu-5']);
  s = { ...s, rewards: [...s.rewards, { key: 'bonus', kind: 'mastery', points: 100, at: T0 }] };
  const b = buildBuilding(s, 'market', T0 + 3 * DAY); assert.ok(b.ok); if (!b.ok) return;
  assert.deepEqual(restore(serialize(b.state)).state.town, b.state.town);
});
test('level-ups follow XP, coins can be spent without dropping level, catalog is sane', () => {
  const s = { ...freshState(), rewards: [{ key: 'a', kind: 'mastery' as const, points: 250, at: T0 }] };
  assert.equal(townView(s, T0).level, 4);   // 50, +60, +70 to reach level 4 at 180 xp
  assert.equal(new Set(BUILDINGS.map(b => b.id)).size, BUILDINGS.length);
  assert.ok(BUILDINGS.every((b, i) => i === 0 || (b.cost >= BUILDINGS[i - 1].cost && b.unlockLevel >= BUILDINGS[i - 1].unlockLevel)), 'costs and levels rise with each chapter');
  assert.equal(new Set(BUILDINGS.map(b => b.slot.join())).size, BUILDINGS.length, 'no two buildings share a spot');
});
