import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FixtureProvider, safeLookup, freshState, capture, submitAttempt, masteryLevel, worldProgress, dueSenses, restore, serialize,
  DAY, RETRY_MS, DAILY_MASTERY_CAP, type Attempt, type LearnerState,
} from '../src/index.ts';

const P = new FixtureProvider();
const T0 = 1_800_000_000_000;
const cap = async (s: LearnerState, q: string, o: any = {}) => capture(s, await safeLookup(P, q), { now: T0, ...o });
const att = (over: Partial<Attempt> = {}): Attempt => ({ key: 'k1', senseId: 'euphemism.n.1', activityId: 'eu-1', skill: 'meaning', correct: true, hintsUsed: 0, errorType: null, at: T0, ...over });

test('capture: saves once, duplicate gives no second reward, context kept private and capped', async () => {
  let { state, outcome } = await cap(freshState(), 'euphemism', { context: 'x'.repeat(900), source: 'Book' });
  assert.equal(outcome, 'saved');
  assert.equal(state.captures[0].context.length, 500);
  const d = await cap(state, 'Euphemism');
  assert.equal(d.outcome, 'duplicate');
  assert.equal(d.state.rewards.length, 1);
  assert.equal(d.state.rewards[0].kind, 'discovery');
});
test('ambiguous word requires the learner to pick a sense; nothing is saved silently', async () => {
  const r = await cap(freshState(), 'fire');
  assert.equal(r.outcome, 'needs-sense');
  assert.equal(Object.keys(r.state.senses).length, 0);
  const picked = await cap(freshState(), 'fire', { senseId: 'fire.v.1' });
  assert.equal(picked.outcome, 'saved');
  assert.ok(picked.state.senses['fire.v.1'] && !picked.state.senses['fire.n.1']);
});
test('unknown word is saved as an honest pending/unknown capture, no lesson invented', async () => {
  const r = await cap(freshState(), 'zzyzx', { context: 'heard on radio' });
  assert.equal(r.outcome, 'unknown');
  assert.equal(r.state.captures[0].senseId, null);
  assert.equal(Object.keys(r.state.senses).length, 0);
  assert.equal((await cap(r.state, 'zzyzx')).outcome, 'duplicate');
});
test('discovery is not mastery: capture + one correct answer stays below secure', async () => {
  let { state } = await cap(freshState(), 'euphemism');
  assert.equal(masteryLevel(state.senses['euphemism.n.1']), 'new');
  state = submitAttempt(state, att()).state;
  assert.equal(masteryLevel(state.senses['euphemism.n.1']), 'practising');
  assert.equal(worldProgress(state).secure, 0);
});
test('attempts are idempotent; retried key never double-counts or double-rewards', async () => {
  let { state } = await cap(freshState(), 'euphemism');
  const a = submitAttempt(state, att());
  const b = submitAttempt(a.state, att());
  assert.equal(b.duplicate, true);
  assert.deepEqual(b.state, a.state);
  assert.equal(a.state.senses['euphemism.n.1'].evidence.meaning!.correct, 1);
});
test('wrong answer: no stage loss, short retry, error type recorded, nothing punitive', async () => {
  let { state } = await cap(freshState(), 'euphemism');
  const ok = submitAttempt(state, att({ key: 'a' })).state;                         // stage 1, due +1d
  const later = T0 + 2 * DAY;
  const w = submitAttempt(ok, att({ key: 'b', at: later, correct: false, errorType: 'register', activityId: 'eu-2', skill: 'usage' })).state;
  const r = w.senses['euphemism.n.1'];
  assert.equal(r.stage, 1);
  assert.equal(r.due, Math.min(T0 + DAY, later + RETRY_MS));
  assert.equal(r.confusions.register, 1);
});
test('hints mean assisted success: recorded, but no stage advance and no mastery reward', async () => {
  let { state } = await cap(freshState(), 'euphemism');
  const r = submitAttempt(state, att({ hintsUsed: 1 }));
  assert.equal(r.stageAdvanced, false);
  assert.equal(r.state.senses['euphemism.n.1'].stage, 0);
  assert.equal(r.state.senses['euphemism.n.1'].evidence.meaning!.assisted, 1);
  assert.equal(r.state.rewards.filter(x => x.kind === 'mastery').length, 0);
});
test('early repeat before due does not advance the stage or farm rewards', async () => {
  let { state } = await cap(freshState(), 'euphemism');
  let s = submitAttempt(state, att({ key: 'a' })).state;
  for (let i = 0; i < 10; i++) s = submitAttempt(s, att({ key: 'r' + i, at: T0 + 1000 * (i + 1), activityId: 'eu-' + (i % 3) })).state;
  assert.equal(s.senses['euphemism.n.1'].stage, 1);
  assert.equal(s.rewards.filter(r => r.kind === 'mastery').length, 1);
});
test('uncertain free answers change no evidence and no schedule', async () => {
  let { state } = await cap(freshState(), 'euphemism');
  const r = submitAttempt(state, att({ correct: null, skill: 'usage', activityId: 'eu-4' })).state;
  const rec = r.senses['euphemism.n.1'];
  assert.equal(rec.evidence.usage, undefined);
  assert.equal(rec.due, state.senses['euphemism.n.1'].due);
  assert.equal(Object.keys(r.attempts).length, 1);
});
test('secure requires two skills incl. recall/usage AND a passed spaced review', async () => {
  let { state } = await cap(freshState(), 'euphemism');
  let t = T0;
  state = submitAttempt(state, att({ key: '1', at: t, skill: 'meaning', activityId: 'eu-1' })).state;
  state = submitAttempt(state, att({ key: '2', at: t + 1, skill: 'usage', activityId: 'eu-2' })).state;
  assert.equal(masteryLevel(state.senses['euphemism.n.1']), 'practising');        // stage 1 only, no spaced review yet
  t += 2 * DAY;
  state = submitAttempt(state, att({ key: '3', at: t, skill: 'usage', activityId: 'eu-5' })).state;
  assert.equal(masteryLevel(state.senses['euphemism.n.1']), 'secure');
  assert.equal(worldProgress(state).secure, 1);
  assert.ok(state.rewards.some(r => r.key === 'mastery:secure:euphemism.n.1'));
});
test('due reviews come from due dates; backwards clock never moves time back', async () => {
  let { state } = await cap(freshState(), 'euphemism');
  state = submitAttempt(state, att({ at: T0 + 5 * DAY })).state;
  assert.equal(state.lastClock, T0 + 5 * DAY);
  const skew = submitAttempt(state, att({ key: 'skew', at: T0, activityId: 'eu-2', skill: 'usage' })).state;   // device clock reset
  assert.ok(skew.attempts['skew'].at >= T0 + 5 * DAY);
  assert.equal(dueSenses(skew, T0 + 5 * DAY + 1).length, 0);
  assert.equal(dueSenses(skew, T0 + 7 * DAY).length, 1);
});
test('daily mastery reward cap holds across many words', async () => {
  const words = ['euphemism', 'tactful', 'indirect', 'understatement', 'polite', 'blunt'];
  let state = freshState();
  for (const w of words) state = (await cap(state, w)).state;
  const ids = Object.keys(state.senses);
  for (let stage = 0; stage < 5; stage++) for (const id of ids) {
    state = submitAttempt(state, att({ key: `${id}-${stage}`, senseId: id, activityId: 'x' + stage, at: T0 + stage * 100 * DAY })).state;
  }
  const perDay = new Map<number, number>();
  for (const r of state.rewards.filter(r => r.kind === 'mastery')) perDay.set(Math.floor(r.at / DAY), (perDay.get(Math.floor(r.at / DAY)) ?? 0) + r.points);
  for (const v of perDay.values()) assert.ok(v <= DAILY_MASTERY_CAP);
});
test('unknown sense id / uncaptured word cannot be practised', () => {
  assert.throws(() => submitAttempt(freshState(), att()), /Capture the word/);
});
test('persistence: round trip, corrupt data, v1 migration, unknown version', async () => {
  let { state } = await cap(freshState(), 'euphemism', { context: 'my boss said it' });
  state = submitAttempt(state, att()).state;
  const rt = restore(serialize(state));
  assert.equal(rt.recovered, 'ok'); assert.deepEqual(rt.state, state);
  assert.equal(restore('{not json').recovered, 'reset');
  assert.equal(restore(JSON.stringify({ version: 99 })).recovered, 'reset');
  assert.equal(restore(JSON.stringify({ version: 2, captures: 'x' })).recovered, 'reset');
  const v1 = { version: 1, xp: 45, mode: 'everyday', large: true, motion: false, words: [
    { word: 'euphemism', context: 'boss', source: 'Work', added: T0, stage: 2, due: T0 + DAY, attempts: 3 },
    { word: 'serendipity', context: 'radio', source: 'Radio', added: T0, stage: 1, due: T0 },
  ] };
  const m = restore(JSON.stringify(v1));
  assert.equal(m.recovered, 'migrated');
  assert.equal(m.state.senses['euphemism.n.1'].stage, 2);
  assert.equal(m.state.captures.find(c => c.query === 'serendipity')!.status, 'pending');   // nothing lost
  assert.equal(m.state.prefs.textScale, 1.25); assert.equal(m.state.prefs.reducedMotion, true);
});
