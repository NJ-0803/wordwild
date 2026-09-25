import test from 'node:test';
import assert from 'node:assert/strict';
import { DEPTH_PROMPT_VERSION, checkDepthDraft, makeDepth, type DepthDraft, type Solver } from '../src/index.ts';

const good = (): DepthDraft => ({
  feel: { tone: 'neutral', note: 'Careful, not rude. It can sound a little cold.' },
  ladder: ['unsure', 'doubtful', 'skeptical', 'cynical'],
  onlyThisWord: [
    { sentence: 'She was ____ about the free phone offer and asked for proof.', other: 'cynical', whyNot: 'Cynical means you expect the worst of people, which is stronger than just wanting proof.' },
    { sentence: 'A ____ buyer checks the shop before paying.', other: 'unsure', whyNot: 'Unsure means not certain, but does not mean you question claims.' },
  ],
});
// a perfect solver: knows the target is "skeptical" and the ladder order
const ORDER = ['unsure', 'doubtful', 'skeptical', 'cynical'];
const solver = (over: { wrongFit?: boolean; alsoFit?: boolean; badLadder?: boolean } = {}): Solver => async ({ prompt, options }) => {
  if (prompt.startsWith('Which word fits')) return { answer: options.indexOf(over.wrongFit ? 'cynical' : 'skeptical') >= 0 && !over.wrongFit ? options.indexOf('skeptical') : (options.indexOf('skeptical') + 1) % 2, alsoCorrect: !!over.alsoFit };
  const rank = (w: string) => ORDER.indexOf(w);
  const idx = options.map(rank);
  const strongest = prompt.includes('STRONGEST');
  const best = strongest ? Math.max(...idx) : Math.min(...idx);
  const i = idx.indexOf(best);
  return { answer: over.badLadder ? (i + 1) % options.length : i, alsoCorrect: false };
};
const exists = async (w: string) => ORDER.includes(w);
const run = (draft: DepthDraft, s: Solver, ex = exists) => makeDepth('skeptical', async () => draft, s, 'm', ex);

test('a good draft passes and every claim is verified', async () => {
  assert.deepEqual(checkDepthDraft('skeptical', good()), []);
  const r = await run(good(), solver());
  assert.ok(r.ok, r.ok ? '' : r.problems.join(';')); if (!r.ok) return;
  assert.equal(r.depth.onlyThisWord.length, 2); assert.deepEqual(r.depth.ladder, ORDER); assert.deepEqual(r.depth.dropped, []);
  assert.equal(r.depth.generatedBy, `m@depth-v${DEPTH_PROMPT_VERSION}`);
});
test('structural gate: blanks, words, tone, ladder shape', () => {
  const bad = (m: (d: DepthDraft) => void) => { const d = good(); m(d); return checkDepthDraft('skeptical', d); };
  assert.ok(bad(d => { d.onlyThisWord[0].sentence = 'No blank here.'; }).some(m => m.includes('one blank')));
  assert.ok(bad(d => { d.onlyThisWord[0].sentence = 'Two ____ blanks ____ here.'; }).some(m => m.includes('one blank')));
  assert.ok(bad(d => { d.onlyThisWord[0].other = 'skeptical'; }).some(m => m.includes('different single word')));
  assert.ok(bad(d => { d.ladder = ['unsure', 'doubtful', 'cynical']; }).some(m => m.includes('4-5')));
  assert.ok(bad(d => { d.ladder = ['unsure', 'doubtful', 'wary', 'cynical']; }).some(m => m.includes('include the target')));
  assert.ok(bad(d => { d.feel.tone = 'angry' as never; }).some(m => m.includes('tone')));
  assert.ok(bad(d => { d.onlyThisWord.pop(); }).some(m => m.includes('2-3')));
  assert.ok(bad(d => { d.onlyThisWord[0].whyNot = '<b>x</b>'; }).some(m => m.includes('reason')));
});
test('a sentence where the solver prefers the synonym, or thinks both fit, is dropped; if none survive the whole thing is rejected', async () => {
  const both = await run(good(), solver({ alsoFit: true }));
  assert.ok(!both.ok && both.stage === 'verify' && !both.transient);
  const wrong = await run(good(), solver({ wrongFit: true }));
  assert.ok(!wrong.ok && wrong.stage === 'verify');
});
test('a ladder the solver disagrees with is dropped but the rest is kept', async () => {
  const r = await run(good(), solver({ badLadder: true }));
  assert.ok(r.ok); if (!r.ok) return;
  assert.deepEqual(r.depth.ladder, []); assert.ok(r.depth.dropped.includes('ladder')); assert.equal(r.depth.onlyThisWord.length, 2);
});
test('ladder words that are not real dictionary words are removed; too few left drops the ladder', async () => {
  const some = await run(good(), solver(), async w => w !== 'doubtful');
  assert.ok(some.ok && some.depth.ladder.join() === 'unsure,skeptical,cynical');
  const few = await run(good(), solver(), async () => false);
  assert.ok(few.ok && few.depth.ladder.length === 0);
});
test('infrastructure trouble is transient; a broken draft is retried once then rejected', async () => {
  const gen = await makeDepth('skeptical', async () => { throw new Error('429'); }, solver(), 'm', exists);
  assert.ok(!gen.ok && gen.transient);
  const down: Solver = async () => { throw new Error('502'); };
  const t = await run(good(), down); assert.ok(!t.ok && t.transient && t.stage === 'verify');
  let calls = 0; const broken = await makeDepth('skeptical', async () => { calls++; const d = good(); d.ladder = ['a']; return d; }, solver(), 'm', exists);
  assert.ok(!broken.ok && !broken.transient && calls === 2);
});
