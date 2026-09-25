import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanOcrWord, joinLines, sentenceAround, unfamiliarWords } from '../src/index.ts';

test('OCR words are cleaned; junk, numbers and single letters are dropped', () => {
  assert.equal(cleanOcrWord('“Skeptical,”'), 'skeptical'); assert.equal(cleanOcrWord("don’t"), "don't"); assert.equal(cleanOcrWord('well-known.'), 'well-known');
  for (const bad of ['', 'a', '123', '4th', '|', '——', 'x'.repeat(40), '@home', null, undefined]) assert.equal(cleanOcrWord(bad as never), null, String(bad));
  assert.equal(cleanOcrWord('मतलब'), 'मतलब', 'non-Latin letters pass; the dictionary decides what it knows');
});
test('lines are joined into sentences and hyphenated words are mended', () => {
  assert.equal(joinLines(['She could not under-', 'stand the letter.', '', 'It was long.']), 'She could not understand the letter. It was long.');
  assert.equal(joinLines(['well-', 'Known Company']), 'well- Known Company', 'a capital after the hyphen is a real hyphen, not a line break');
});
test('the sentence a word appeared in is found, whole-word only, and capped', () => {
  const lines = ['The manager was skeptical about the plan.', 'Nobody agreed. The plan was not skepticism at all.'];
  assert.equal(sentenceAround(lines, 'skeptical'), 'The manager was skeptical about the plan.');
  assert.equal(sentenceAround(lines, 'skeptic'), '', 'skeptic is not a whole word here');
  assert.equal(sentenceAround(['a. '.repeat(10) + 'x'.repeat(500) + ' word'], 'word').length <= 300, true);
  assert.equal(sentenceAround(['under-', 'stand this now.'], 'understand'), 'understand this now.');
});
test('unfamiliar words: hardest first, no common words, low-confidence OCR ignored, no duplicates, limit kept', () => {
  const words = [['The', 90], ['meticulous', 95], ['committee', 88], ['meticulous', 90], ['and', 99], ['xqzv', 30], ['plan', 92], ['announced', 91]].map(([clean, conf]) => ({ clean: String(clean).toLowerCase(), conf: Number(conf) }));
  const r = unfamiliarWords(words, 2.5, w => ({ meticulous: 4, committee: 3, announced: 3, plan: 1 } as Record<string, number>)[w] ?? 3);
  assert.deepEqual(r, ['meticulous', 'committee', 'announced']);
  assert.equal(unfamiliarWords(words, 5, () => 3).length, 0, 'nothing is "unfamiliar" to a very advanced reader');
  assert.equal(unfamiliarWords(words, 1, () => 3, 2).length, 2);
});
