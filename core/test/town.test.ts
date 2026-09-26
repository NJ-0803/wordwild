import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planPiece, sectorAt, SECTOR_W, FixtureProvider, safeLookup, freshState, capture, submitAttempt, townView, cityPoints, cityView, PLAN, POINTS, BUILDINGS, DAY, finishScene,
  exportEvents, mergeEvents, rebuildState, sanitizeEvents, restore, serialize, type LearnerState, type Attempt,
} from '../src/index.ts';

const P = new FixtureProvider(); const T0 = 1_800_000_000_000;
const cap = async (s: LearnerState, q: string, at = T0, o: any = {}) => capture(s, await safeLookup(P, q), { now: at, ...o }).state;
const att = (over: Partial<Attempt> = {}): Attempt => ({ key: 'k1', senseId: 'euphemism.n.1', activityId: 'eu-1', skill: 'meaning', correct: true, hintsUsed: 0, errorType: null, at: T0 + 1000, ...over });

test('a new town: a hamlet with only your cottage, everything else waiting', () => {
  const v = townView(freshState());
  assert.equal(v.points, 0); assert.equal(v.built.length, 1); assert.equal(v.built[0].id, 'home'); assert.equal(v.title, 'Hamlet');
  assert.equal(v.next?.id, 'wheat'); assert.equal(v.buildings.find(b => b.id === 'home')!.status, 'built');
  assert.ok(v.buildings.filter(b => b.id !== 'home').every(b => b.status === 'locked'));
});
test('the first saved word already grows the town (first seeds), so effort is rewarded at once', async () => {
  const s = await cap(freshState(), 'euphemism');
  assert.equal(cityPoints(s), POINTS.saved); const v = cityView(s);
  assert.ok(v.built.some(p => p.id === 'wheat'), 'the first word plants the first seeds');
});
test('points come only from real learning: saving, practising, mastering, puzzles, scenes', async () => {
  let s = await cap(freshState(), 'euphemism'); const saved = cityPoints(s);
  s = submitAttempt(s, att()).state; assert.equal(cityPoints(s), saved + POINTS.practised);
  for (let i = 0; i < 20; i++) s = submitAttempt(s, att({ key: 'spam' + i, at: T0 + 100 + i })).state;
  assert.ok(cityPoints(s) <= saved + POINTS.practised + POINTS.secure, 'repeating answers cannot farm points');
});
test('the town only grows: more points never remove a piece, and a year of missed days costs nothing', async () => {
  let s = freshState(); let last = 0;
  for (const w of ['euphemism', 'polite', 'blunt', 'tactful']) { try { s = await cap(s, w); } catch { continue; } const n = cityView(s).built.length; assert.ok(n >= last); last = n; }
  assert.equal(cityView(s).built.length, townView(s, T0 + 400 * DAY).built.length);
});
test('the plan is sane: thresholds rise, ids and spots are unique, every story chapter has a building', () => {
  for (let i = 1; i < PLAN.length; i++) assert.ok(PLAN[i].at > PLAN[i - 1].at, PLAN[i].id);
  assert.equal(new Set(PLAN.map(p => p.id)).size, PLAN.length);
  assert.equal(new Set(PLAN.map(p => p.slot.join())).size, PLAN.length, 'no two pieces share a spot');
  for (const b of BUILDINGS) assert.ok(PLAN.some(p => p.civic === b.id), b.id);
  assert.equal(PLAN[0].at, 0);
});
test('pacing: about ten words in one sitting builds a real neighbourhood; the whole plan is a few weeks of steady learning', () => {
  const tenWords = 10 * (POINTS.saved + POINTS.practised); assert.ok(PLAN.filter(p => p.at <= tenWords).length >= 6);
  const last = PLAN[PLAN.length - 1].at; assert.ok(last / (POINTS.saved + POINTS.practised) <= 200, `${last} points`);
});
test('scenes need their building: the market chapter opens when the market is built', () => {
  const s0 = freshState();
  assert.equal(finishScene(s0, 'market-hint', 10).ok, false);
  const grown = { ...s0, senses: Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`w${i}`, { senseId: `w${i}`, lastAttemptAt: 0, capturedAt: 1, due: 1, stage: 0, evidence: {} }])) } as unknown as LearnerState;
  assert.ok(cityView(grown).builtIds.has('market'));
  assert.equal(finishScene(grown, 'market-hint', 10).ok, true);
});
test('old town events (build, claim) are ignored, and old saves still load', () => {
  const clean = sanitizeEvents({ town: [{ key: 'build:market', kind: 'build', ref: 'market', at: 1 }, { key: 'claim:1:x:0', kind: 'claim', ref: '1:x:0', at: 1 }] } as never);
  assert.deepEqual(clean.town ?? [], []);
  assert.deepEqual(restore(JSON.stringify({ ...freshState(), town: undefined })).state.town, []);
});
test('scene events sync and rebuild', () => {
  const r = finishScene(freshState(), 'home-tea', T0); assert.ok(r.ok); if (!r.ok) return;
  const ev = exportEvents(r.state); assert.equal(rebuildState(mergeEvents(ev, ev)).town.length, 1);
  assert.deepEqual(restore(serialize(r.state)).state.town, r.state.town);
});

test('endless growth: pieces keep coming, ascending, never overlapping, sector by sector', () => {
  const seen = new Set<string>(); let prev = -1;
  for (let i = 0; i < 700; i++) { const p = planPiece(i); assert.ok(p.at > prev, `piece ${i}`); prev = p.at; const key = `${p.slot.join()}${p.opens ? 'o' : ''}`; assert.ok(!seen.has(key), `${p.id} overlaps`); seen.add(key); assert.ok(!seen.has(p.id)); seen.add(p.id); }
  assert.deepEqual(sectorAt(0), [0, 0]); assert.equal(new Set(Array.from({ length: 60 }, (_, i) => sectorAt(i).join())).size, 60);
  assert.ok(Array.from({ length: 60 }, (_, i) => sectorAt(i)).every(([, j]) => j >= 0), 'the city grows east, west and south of the river, never into it');
  const gaps = Array.from({ length: 300 }, (_, i) => planPiece(i + 1).at - planPiece(i).at); assert.ok(gaps.every(g => g >= 3 && g <= 90), 'each new piece is always within reach');
});
test('a big learner gets a big city: sectors open with their avenues, and the town never shrinks', () => {
  const big = (n: number) => ({ ...freshState(), senses: Object.fromEntries(Array.from({ length: n }, (_, i) => [`w${i}`, { senseId: `w${i}`, lastAttemptAt: 0, capturedAt: 1, due: 1, stage: 0, evidence: {} }])) }) as unknown as LearnerState;
  const a = cityView(big(50)), b = cityView(big(400)), c = cityView(big(1500));
  assert.ok(a.size < b.size && b.size < c.size); assert.ok(b.sectors.length >= 2 && c.sectors.length > b.sectors.length);
  assert.equal(a.sectors[0].avenues, a.builtIds.has('avenues')); assert.ok(c.sectors.every(s => Math.abs(s.ox) % SECTOR_W === 0));
  for (const p of a.built) assert.ok(b.builtIds.has(p.id), 'nothing built is ever removed');
});
