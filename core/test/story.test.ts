import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENES, validateScenes, SCENE_REWARD, BUILDINGS, SENSES, freshState, townView, buildBuilding, finishScene, scenesFor, sanitizeTownEvents, exportEvents, rebuildState, mergeEvents } from '../src/index.ts';
import type { LearnerState } from '../src/index.ts';

const ids = new Set(SENSES.map(s => s.senseId)); const bids = new Set(BUILDINGS.map(b => b.id));
const rich = (): LearnerState => ({ ...freshState(), rewards: [{ key: 'r', senseId: 'x', kind: 'discovery', points: 5000, at: 1 }] as never });

test('every scene is structurally valid and uses real curated words', () => {
  assert.deepEqual(validateScenes(SCENES, ids, bids), []);
});
test('every building has at least one scene', () => {
  for (const b of BUILDINGS) assert.ok(scenesFor(b.id).length >= 1, b.id);
});
test('validator catches a broken scene', () => {
  const bad = structuredClone(SCENES[0]); bad.beats = bad.beats.filter(b => b.kind !== 'choose');
  assert.ok(validateScenes([bad], ids, bids).length > 0);
  const unk = structuredClone(SCENES[0]); const w = unk.beats.find(b => b.kind === 'word'); if (w && w.kind === 'word') w.senseId = 'nope.n.9';
  assert.ok(validateScenes([unk], ids, bids).some(p => p.includes('unknown sense')));
});
test('finishing a scene pays once, needs the building, replay is free', () => {
  const s = rich();
  assert.equal(finishScene(s, 'market-hint', 10).ok, false);            // market not built
  const home = finishScene(s, 'home-tea', 10); assert.ok(home.ok);
  if (!home.ok) return;
  const before = townView(s, 20), after = townView(home.state, 20);
  assert.equal(after.coins - before.coins, SCENE_REWARD.coins); assert.equal(after.xp - before.xp, SCENE_REWARD.xp);
  assert.equal(finishScene(home.state, 'home-tea', 30).ok, false);       // already seen
  const b = buildBuilding(home.state, 'market', 40); // may be locked by level; rich state has plenty of xp
  assert.ok(b.ok);
});
test('scene events survive sync round-trip and merge', () => {
  const s0 = rich(); const r = finishScene(s0, 'home-tea', 10); assert.ok(r.ok); if (!r.ok) return;
  const ev = exportEvents(r.state);
  assert.equal(sanitizeTownEvents(ev.town).length, 1);
  const merged = mergeEvents(ev, ev); assert.equal(merged.town?.length, 1);
  const rebuilt = rebuildState(merged);
  assert.equal(rebuilt.town.filter(e => e.kind === 'scene').length, 1);
});
test('sanitize drops forged scene events', () => {
  const out = sanitizeTownEvents([{ key: 'scene:fake', kind: 'scene', ref: 'fake', at: 1 }, { key: 'scene:home-tea', kind: 'scene', ref: 'market-hint', at: 1 }]);
  assert.equal(out.length, 0);
});
