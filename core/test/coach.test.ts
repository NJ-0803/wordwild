import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCoachDraft, makeCoach, containsForm, INTENTS } from '../src/index.ts';
import type { CoachDraft, Solver } from '../src/index.ts';

const DEF = 'being present everywhere at once';
const good = (): CoachDraft => ({
  examples: [
    { intent: 'interview', sentence: 'In my last job, mobile phones were ubiquitous, so every customer expected an app.' },
    { intent: 'essay', sentence: 'Social media has become ubiquitous in modern student life, changing how friendships form.' },
    { intent: 'casual', sentence: 'Honestly, coffee shops are ubiquitous in this city, you cannot walk one street without seeing one.' },
    { intent: 'story', sentence: 'The ubiquitous smell of rain followed her through every room of the old house.' },
  ],
  memoryHook: 'Think "you be quiet" everywhere: the word is about something that is found in every place.',
  confusables: [{ word: 'unique', difference: 'Unique means only one exists; ubiquitous means there are many, everywhere.' }, { word: 'common', difference: 'Common is usual; ubiquitous is so common it is in every place.' }],
  notFor: ['Do not use it for something that is only in a few places.'],
});
const defs: Record<string, string> = { unique: 'the only one of its kind', common: 'occurring frequently' };
const defOf = async (w: string) => defs[w] ?? null;
// a solver that always picks the target definition, "True", or the right part of speech
const yes: Solver = async ({ options }) => ({ answer: Math.max(0, options.findIndex(o => o === DEF || o === 'True' || o === 'adjective')), alsoCorrect: false });

test('a good draft passes the checks and, with a confirming solver, is kept whole', async () => {
  assert.deepEqual(checkCoachDraft('ubiquitous', DEF, good()), []);
  const out = await makeCoach('ubiquitous', { definition: DEF, pos: 'adjective', checkPos: true }, async () => good(), yes, 'm', defOf);
  assert.ok(out.ok); if (!out.ok) return;
  assert.equal(out.coach.examples.length, 4); assert.equal(out.coach.confusables.length, 2); assert.equal(out.coach.confusables[0].definition, defs.unique);
  assert.equal(out.coach.notFor.length, 1); assert.deepEqual(out.coach.examples.map(e => e.intent).sort(), [...INTENTS].sort());
});
test('the brief: ubiquitous examples must be natural, not repetitive', () => {
  const rep = good(); rep.examples.forEach(e => { e.sentence = 'The ubiquitous phone is everywhere in the modern world today.'; });
  assert.ok(checkCoachDraft('ubiquitous', DEF, rep).some(p => /start the same|too alike/.test(p)));
});
test('examples must use the word, be sentence-sized and clean', () => {
  const d = good(); d.examples[0].sentence = 'I like my job very much and I want to work here for many years.'; assert.ok(checkCoachDraft('ubiquitous', DEF, d).some(p => /must use the word/.test(p)));
  const s = good(); s.examples[1].sentence = 'Ubiquitous.'; assert.ok(checkCoachDraft('ubiquitous', DEF, s).some(p => /6-26 words/.test(p)));
  const h = good(); h.examples[2].sentence = 'Check <b>ubiquitous</b> at https://x.com for many more useful examples today.'; assert.ok(checkCoachDraft('ubiquitous', DEF, h).length > 0);
  const m = good(); m.examples = m.examples.slice(0, 3); assert.ok(checkCoachDraft('ubiquitous', DEF, m).some(p => /exactly one example/.test(p)));
  assert.ok(containsForm('Phones are everywhere and popular.', 'popular')); assert.ok(containsForm('She was hoping to leave.', 'hope')); assert.ok(!containsForm('It was a nice day.', 'ubiquitous'));
});
test('memory hooks may not claim word history', () => {
  const d = good(); d.memoryHook = 'This word comes from Latin ubique, which means everywhere, so remember that.'; assert.ok(checkCoachDraft('ubiquitous', DEF, d).some(p => /word history/.test(p)));
});
test('look-alike words that are not in the dictionary are dropped; the coach works without any', async () => {
  const d = good(); d.confusables = [{ word: 'unique', difference: 'Unique means only one exists; ubiquitous means many.' }, { word: 'zorbling', difference: 'A made up word that means something else entirely.' }];
  const out = await makeCoach('ubiquitous', { definition: DEF, pos: 'adjective', checkPos: true }, async () => d, yes, 'm', defOf); assert.ok(out.ok && out.coach.confusables.length === 1 && out.coach.dropped.some(x => /zorbling/.test(x)));
  const none = good(); none.confusables = [{ word: 'zorbling', difference: 'A made up word that means something else entirely.' }];
  const bad = await makeCoach('ubiquitous', { definition: DEF, pos: 'adjective', checkPos: true }, async () => none, yes, 'm', defOf); assert.ok(bad.ok && bad.coach.confusables.length === 0, 'an invented look-alike is dropped; the coach still works without any');
  const empty = good(); empty.confusables = []; assert.deepEqual(checkCoachDraft('ubiquitous', DEF, empty), [], 'no look-alike is a valid answer');
});
test('an example the blind solver does not confirm is dropped; too few confirmed fails', async () => {
  let n = 0; const picky: Solver = async ({ options }) => { const c = ++n; const right = options.findIndex(o => o === DEF || o === 'True' || o === 'adjective'); return { answer: c === 1 ? (right + 1) % options.length : right, alsoCorrect: false }; };
  const out = await makeCoach('ubiquitous', { definition: DEF, pos: 'adjective', checkPos: true }, async () => good(), picky, 'm', defOf); assert.ok(out.ok && out.coach.examples.length === 3 && out.coach.dropped.length >= 1);
  const no: Solver = async ({ options }) => ({ answer: (options.findIndex(o => o === DEF) + 1) % options.length, alsoCorrect: false });
  const fail = await makeCoach('ubiquitous', { definition: DEF, pos: 'adjective', checkPos: true }, async () => good(), no, 'm', defOf); assert.ok(!fail.ok);
});
test('an "avoid" statement the solver calls false is not shown', async () => {
  const s: Solver = async ({ options, prompt }) => { const i = options.findIndex(o => (/statement/.test(prompt) ? o === 'False' : /used as a noun/.test(prompt) ? o === 'adjective' : o === DEF)); return { answer: i, alsoCorrect: false }; };
  const out = await makeCoach('ubiquitous', { definition: DEF, pos: 'adjective', checkPos: true }, async () => good(), s, 'm', defOf); assert.ok(out.ok && out.coach.notFor.length === 0);
});
test('infrastructure trouble is transient, never a verdict on the word', async () => {
  const boom: Solver = async () => { throw new Error('429'); };
  const out = await makeCoach('ubiquitous', { definition: DEF, pos: 'adjective', checkPos: true }, async () => good(), boom, 'm', defOf); assert.ok(!out.ok && out.transient);
  const gen = await makeCoach('ubiquitous', { definition: DEF, pos: 'adjective', checkPos: true }, async () => { throw new Error('down'); }, yes, 'm', defOf); assert.ok(!gen.ok && gen.transient);
});
test('a bad first draft is retried once', async () => {
  let n = 0; const out = await makeCoach('ubiquitous', { definition: DEF, pos: 'adjective', checkPos: true }, async () => (++n === 1 ? { ...good(), memoryHook: 'short' } : good()), yes, 'm', defOf); assert.ok(out.ok); assert.equal(n, 2);
});
test('an example that uses the word as the wrong part of speech is dropped (the "cool" noun problem)', async () => {
  const wrongPos: Solver = async ({ options, prompt }) => {
    const i = options.findIndex(o => (/used as a noun/.test(prompt) ? (/ubiquitous smell/.test(prompt) ? o === 'noun' : o === 'adjective') : o === DEF || o === 'True'));
    return { answer: i, alsoCorrect: false };
  };
  const out = await makeCoach('ubiquitous', { definition: DEF, pos: 'adjective', checkPos: true }, async () => good(), wrongPos, 'm', defOf);
  assert.ok(out.ok && out.coach.examples.length === 3 && out.coach.dropped.some(x => /different part of speech/.test(x)));
});
test('the second attempt is told what was wrong with the first', async () => {
  const seen: (string[] | undefined)[] = [];
  await makeCoach('ubiquitous', { definition: DEF, pos: 'adjective', checkPos: true }, async (p) => { seen.push(p); return seen.length === 1 ? { ...good(), memoryHook: 'short' } : good(); }, yes, 'm', defOf);
  assert.equal(seen[0], undefined); assert.ok(seen[1] && seen[1].some(x => /memoryHook/.test(x)));
});
test('a draft that fails verification gets one fresh, informed try before giving up', async () => {
  let gens = 0; let solves = 0;
  const flaky: Solver = async ({ options }) => { solves++; const right = options.findIndex(o => o === DEF || o === 'True' || o === 'adjective'); return { answer: gens < 2 ? (right + 1) % options.length : right, alsoCorrect: false }; };
  const out = await makeCoach('ubiquitous', { definition: DEF, pos: 'adjective', checkPos: true }, async () => { gens++; return good(); }, flaky, 'm', defOf);
  assert.ok(out.ok); assert.equal(gens, 2); assert.ok(solves > 0);
  let g2 = 0; const never: Solver = async ({ options }) => ({ answer: (options.findIndex(o => o === DEF) + 1) % options.length, alsoCorrect: false });
  const fail = await makeCoach('ubiquitous', { definition: DEF, pos: 'adjective' }, async () => { g2++; return good(); }, never, 'm', defOf); assert.ok(!fail.ok); assert.equal(g2, 2, 'never more than two tries');
});
test('batched verification: one call for every check, same verdicts as the separate path', async () => {
  let calls = 0; let size = 0;
  const many: import('../src/index.ts').SolveMany = async (items) => { calls++; size = items.length; return items.map(it => ({ answer: Math.max(0, it.options.findIndex(o => o === DEF || o === 'True' || o === 'adjective')), alsoCorrect: false })); };
  const out = await makeCoach('ubiquitous', { definition: DEF, pos: 'adjective', checkPos: true }, async () => good(), async () => { throw new Error('should not be used'); }, 'm', defOf, many);
  assert.ok(out.ok && out.coach.examples.length === 4 && out.coach.notFor.length === 1); assert.equal(calls, 1); assert.equal(size, 4 + 4 + 1, '4 meanings + 4 parts of speech + 1 statement');
  const failing = await makeCoach('ubiquitous', { definition: DEF, pos: 'adjective' }, async () => good(), async () => { throw new Error('x'); }, 'm', defOf, async () => null);
  assert.ok(!failing.ok && failing.transient, 'a failed batch call is an outage, not a verdict');
  const halfway: import('../src/index.ts').SolveMany = async (items) => items.map((it, i) => (i === 0 ? null : { answer: Math.max(0, it.options.findIndex(o => o === DEF || o === 'True')), alsoCorrect: false }));
  const part = await makeCoach('ubiquitous', { definition: DEF, pos: 'adjective' }, async () => good(), async () => { throw new Error('x'); }, 'm', defOf, halfway);
  assert.ok(!part.ok && part.transient, 'an unanswered item is unavailable, never quietly accepted');
});
