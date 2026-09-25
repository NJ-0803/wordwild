import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SENSES, SENSE_BY_ID, FixtureProvider, safeLookup, freshState, capture, submitAttempt, recommend, demonstratedLevel, nextActivity, gradeChoice, gradeExplain,
  DAY, type LearnerState, type ChoiceItem, type ExplainItem,
} from '../src/index.ts';

const P = new FixtureProvider(); const T0 = 1_800_000_000_000;
const cap = async (s: LearnerState, q: string) => capture(s, await safeLookup(P, q), { now: T0 }).state;
const ok = (s: LearnerState, senseId: string, key: string, at = T0) =>
  submitAttempt(s, { key, senseId, activityId: key, skill: 'meaning', correct: true, hintsUsed: 0, errorType: null, at }).state;

test('capturing a very hard word does not raise the estimated ability', async () => {
  const s = await cap(freshState(), 'euphemism');
  assert.equal(demonstratedLevel(s, SENSE_BY_ID), 1);
});
test('prerequisite recovery: recommending euphemism-adjacent words teaches the easier idea first, with a reason', async () => {
  let s = await cap(freshState(), 'euphemism');
  s = ok(s, 'euphemism.n.1', 'a');
  const recs = recommend(s, SENSE_BY_ID, T0 + 1000, 5);
  const understate = recs.find(r => r.senseId === 'indirect.adj.1');
  assert.ok(understate, 'indirect (prereq of understatement) should be suggested');
  assert.ok(recs.every(r => r.reason.text && r.reason.code));
  const prereq = recs.find(r => r.kind === 'prerequisite');
  assert.ok(prereq && /helps you understand/.test(prereq.reason.text));
});
test('due reviews come first with an explanation; challenge rises as evidence improves', async () => {
  let s = await cap(freshState(), 'polite');
  s = ok(s, 'polite.adj.1', 'p');
  const due = recommend(s, SENSE_BY_ID, T0 + 2 * DAY);
  assert.equal(due[0].kind, 'review'); assert.equal(due[0].reason.code, 'due');
  const fresh = recommend(freshState(), SENSE_BY_ID, T0);
  const low = recommend(s, SENSE_BY_ID, T0 + 1000);
  const diff = (r: any) => SENSE_BY_ID[r.senseId].difficulty;
  assert.ok(diff(fresh[0]) <= 2, 'a brand-new learner starts easy');
  assert.ok(low.every(r => diff(r) <= 3), 'one easy word does not jump to hardest');
});
test('same-lemma sibling sense is never pushed after one sense was chosen', async () => {
  const s = capture(freshState(), await safeLookup(P, 'fire'), { now: T0, senseId: 'fire.v.1' }).state;
  assert.ok(!recommend(s, SENSE_BY_ID, T0, 10).some(r => r.senseId === 'fire.n.1'));
});
test('next activity: varies item and answer position; explain-back not first', async () => {
  let s = await cap(freshState(), 'euphemism');
  const sense = SENSE_BY_ID['euphemism.n.1'];
  const a1 = nextActivity(s, sense, 'seed1');
  assert.notEqual(a1.item.kind, 'explain-back');
  const pos1 = a1.optionOrder!.indexOf((a1.item as ChoiceItem).correctId);
  s = submitAttempt(s, { key: 'x', senseId: sense.senseId, activityId: a1.item.id, skill: a1.item.skill, correct: true, hintsUsed: 0, errorType: null, at: T0 }).state;
  const a2 = nextActivity(s, sense, 'seed2', pos1);
  assert.notEqual(a2.item.id, a1.item.id, 'recall uses a different context');
  if (a2.item.kind !== 'explain-back') assert.notEqual(a2.optionOrder!.indexOf(a2.item.correctId), pos1);
  const det = nextActivity(s, sense, 'seed2', pos1);
  assert.deepEqual(det.optionOrder, a2.optionOrder);                  // deterministic per seed
});
test('every choice item: all options graded, wrong answers explain why and never say "wrong"', () => {
  for (const sn of SENSES) for (const it of sn.practice) if (it.kind !== 'explain-back') {
    for (const o of it.options) {
      const f = gradeChoice(it, o.id);
      assert.equal(f.correct, o.id === it.correctId);
      if (!f.correct) { assert.ok(f.message.length > 10, `${it.id}`); assert.ok(!/\b(wrong|incorrect|stupid|fail)/i.test(f.message)); }
    }
  }
});
test('explain-back is uncertainty-aware: valid alternative wording is never marked wrong', () => {
  const it = SENSE_BY_ID['euphemism.n.1'].practice.find(p => p.kind === 'explain-back') as ExplainItem;
  assert.equal(gradeExplain(it, 'It is a softer word used instead of a harsh one, like passed away.').level, 'covered');
  const alt = gradeExplain(it, 'When people avoid the ugly truth by choosing pretty words');   // valid, different wording
  assert.equal(alt.correct, null); assert.notEqual(alt.level, 'covered'); assert.ok(alt.modelAnswer);
  assert.equal(gradeExplain(it, 'ok').correct, null);
  assert.equal(gradeExplain(it, '').level, 'unsure');
});

test('a saved dictionary word that is not in the catalogue is never recommended and never breaks recommendations', async () => {
  const dict = { senseId: 'skeptical%5:00:00:distrustful:00', lemma: 'skeptical' } as any;
  let s = capture(freshState(), { status: 'found', senses: [dict], source: 'wordnet' }, { now: T0 }).state;
  s = await cap(s, 'polite');
  const recs = recommend(s, SENSE_BY_ID, T0 + 1000, 10);
  assert.ok(recs.length > 0);
  assert.ok(recs.every(r => SENSE_BY_ID[r.senseId]), 'every recommendation must be a word we can teach');
  assert.ok(!recs.some(r => r.senseId === dict.senseId));
  // even if it somehow has attempts and is due, it is skipped
  s = { ...s, senses: { ...s.senses, [dict.senseId]: { ...s.senses[dict.senseId], lastAttemptAt: T0, due: T0 } } };
  assert.ok(recommend(s, SENSE_BY_ID, T0 + DAY, 10).every(r => SENSE_BY_ID[r.senseId]));
});
