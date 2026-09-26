import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENES, validateScenes, BUILDINGS, SENSES, freshState, cityView, finishScene, scenesFor, sanitizeTownEvents, exportEvents, rebuildState, mergeEvents } from '../src/index.ts';
import type { LearnerState } from '../src/index.ts';

const ids = new Set(SENSES.map(s => s.senseId)); const bids = new Set(BUILDINGS.map(b => b.id));
const rich = (): LearnerState => ({ ...freshState(), senses: Object.fromEntries(Array.from({ length: 400 }, (_, i) => [`w${i}`, { senseId: `w${i}`, lastAttemptAt: 0, capturedAt: 1, due: 1, stage: 0, evidence: {} }])) } as unknown as LearnerState);

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
test('finishing a scene needs the building, happens once, replay is free', () => {
  const none = freshState(); assert.equal(finishScene(none, 'market-hint', 10).ok, false);       // market not built yet
  const s = rich();
  const home = finishScene(s, 'home-tea', 10); assert.ok(home.ok);
  if (!home.ok) return;
  assert.equal(finishScene(home.state, 'home-tea', 30).ok, false);       // already seen
  assert.ok(cityView(home.state).builtIds.has('market'));
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
