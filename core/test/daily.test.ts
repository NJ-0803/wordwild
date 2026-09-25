import test from 'node:test';
import assert from 'node:assert/strict';
import { FixtureProvider, safeLookup, freshState, capture, submitAttempt, pickDaily, dailyMessage, localHour, sanitizeTelegramText, DAY, type LearnerState } from '../src/index.ts';

const P = new FixtureProvider(); const T0 = 1_800_000_000_000;
const cap = async (s: LearnerState, q: string, at = T0) => capture(s, await safeLookup(P, q), { now: at }).state;
const ok = (s: LearnerState, id: string, key: string, at: number) => submitAttempt(s, { key, senseId: id, activityId: key, skill: 'meaning', correct: true, hintsUsed: 0, errorType: null, at }).state;

test('review first: the oldest ripe word wins; resting words are not offered', async () => {
  let s = await cap(freshState(), 'polite'); s = ok(s, 'polite.adj.1', 'a', T0 + 10);
  s = await cap(s, 'blunt', T0 + 20); s = ok(s, 'blunt.adj.1', 'b', T0 + 30);
  assert.equal(pickDaily(s, T0 + 100, 0).kind, 'none', 'both resting, nothing saved-but-unpractised, no candidates: say nothing');
  const later = pickDaily(s, T0 + 2 * DAY, 0); assert.equal(later.kind, 'review'); assert.equal(later.senseId, 'polite.adj.1', 'oldest due first');
});
test('a saved but never practised word is offered next', async () => {
  const s = await cap(freshState(), 'euphemism');
  assert.deepEqual(pickDaily(s, T0 + 5, 0), { kind: 'first', senseId: 'euphemism.n.1' });
});
test('otherwise a new word from the constellation, never one already saved, and silence when there is nothing', async () => {
  let s = await cap(freshState(), 'polite'); s = ok(s, 'polite.adj.1', 'a', T0 + 10);
  const cands = [{ senseId: 'polite.adj.1', lemma: 'polite', from: 'blunt' }, { senseId: 'tactful.adj.1', lemma: 'tactful', from: 'polite' }];
  assert.deepEqual(pickDaily(s, T0 + 100, 0, cands), { kind: 'new', senseId: 'tactful.adj.1', from: 'polite' });
  assert.deepEqual(pickDaily(freshState(), T0, 0), { kind: 'none' });
});
test('missed days never pile up: a year of silence still yields ONE word, not a backlog', async () => {
  let s = await cap(freshState(), 'polite'); s = ok(s, 'polite.adj.1', 'a', T0 + 10);
  s = await cap(s, 'blunt', T0 + 20); s = ok(s, 'blunt.adj.1', 'b', T0 + 30);
  const p = pickDaily(s, T0 + 365 * DAY, 0); assert.equal(p.kind, 'review'); assert.ok(p.senseId);
});
test('message: escaped, short, language-aware, honest wording', () => {
  const w = { lemma: 'a<b', pos: 'noun', simple: 'Rock & roll', hindi: 'हिंदी', example: 'x > y' };
  const m = dailyMessage('review', w, 'hi'); assert.ok(m.includes('a&lt;b') && m.includes('Rock &amp; roll') && m.includes('x &gt; y') && m.includes('हिंदी') && m.includes('ready to harvest'));
  assert.ok(!dailyMessage('new', w, 'en', 'skeptical').includes('हिंदी')); assert.ok(dailyMessage('new', w, 'en', 'skeptical').includes('next to “skeptical”'));
  assert.ok(dailyMessage('first', { ...w, simple: 'x'.repeat(2000) }, 'en').length <= 900);
  assert.ok(!/streak|lost|miss|don't forget|hurry/i.test(dailyMessage('review', w, 'en')), 'no pressure language');
});
test('local hour honours the learner timezone; telegram text is sanitised', () => {
  const t = Date.UTC(2026, 8, 25, 2, 30);            // 02:30 UTC
  assert.equal(localHour(t, 330), 8); assert.equal(localHour(t, 0), 2); assert.equal(localHour(t, -300), 21);
  assert.equal(sanitizeTelegramText('  hi\u0000 there\n'), 'hi  there'); assert.equal(sanitizeTelegramText('x'.repeat(500)).length, 100); assert.equal(sanitizeTelegramText(null), '');
});

import { dailyMessageWhatsApp, waSafe, chunkText, parseWaCommand } from '../src/index.ts';
test('WhatsApp message: formatting characters in dictionary text cannot bold or strike anything, no pressure, opt-out line present', () => {
  const m = dailyMessageWhatsApp('review', { lemma: 'a*b', pos: 'noun', simple: '~x~ `y` _z_', hindi: 'हिंदी', example: 'e*g' }, 'hi');
  assert.ok(m.includes('*ab*') && !m.includes('~x~') && !m.includes('`') && m.includes('हिंदी') && m.includes('Reply STOP'));
  assert.equal((m.match(/\*/g) ?? []).length, 2, 'only our own bold markers remain');
  assert.ok(!/streak|lost|missed|hurry/i.test(m)); assert.equal(waSafe('a*b_c~d`e'), 'abcde');
  assert.ok(!dailyMessageWhatsApp('new', { lemma: 'x', pos: 'n', simple: 's', hindi: 'हिंदी' }, 'en').includes('हिंदी'));
  assert.ok(dailyMessageWhatsApp('first', { lemma: 'x', pos: 'n', simple: 'y'.repeat(3000) }, 'en').length <= 1000);
});
test('chunking keeps every character and respects the limit', () => {
  const t = Array.from({ length: 12 }, (_, i) => `para ${i} ` + 'x'.repeat(600)).join('\n\n');
  const parts = chunkText(t, 1500); assert.ok(parts.every(p => p.length <= 1500)); assert.equal(parts.join('\n\n').replace(/\s+/g, ''), t.replace(/\s+/g, ''));
  assert.deepEqual(chunkText('short'), ['short']); assert.ok(chunkText('z'.repeat(5000), 1000).every(p => p.length <= 1000));
});
test('WhatsApp commands: STOP in every common spelling, LINK with a code, words, and nothing', () => {
  for (const s of ['STOP', 'stop', ' Unsubscribe ', 'CANCEL', 'opt-out', 'optout', 'रुको']) assert.equal(parseWaCommand(s).kind, 'stop', s);
  assert.deepEqual(parseWaCommand('LINK abc123_-'), { kind: 'link', code: 'abc123_-' }); assert.equal(parseWaCommand('link short').kind, 'word', 'a bad code is treated as text, never as a link');
  assert.equal(parseWaCommand('link ../../etc').kind, 'word');
  assert.equal(parseWaCommand('Hello').kind, 'start'); assert.equal(parseWaCommand('help').kind, 'help');
  assert.deepEqual(parseWaCommand('skeptical'), { kind: 'word', text: 'skeptical' });
  for (const n of [null, undefined, '', '   ', 42 as never]) assert.notEqual(parseWaCommand(n).kind, 'link');
  assert.equal(parseWaCommand('').kind, 'ignore');
});
