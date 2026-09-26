import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, formatTime, heardMatches, ANSWERS_5, SCRAMBLE, MATCH_WORDS, dailyAnswer, scoreGuess, keyStates, wordStatus, shareGrid, dailyScramble, dailyMatch, meaningOrder, MAX_TRIES } from '../src/index.ts';

test('lists are clean: lowercase letters only, right lengths, no duplicates', () => {
  assert.ok(ANSWERS_5.every(w => /^[a-z]{5}$/.test(w))); assert.equal(new Set(ANSWERS_5).size, ANSWERS_5.length);
  assert.ok(SCRAMBLE.every(w => /^[a-z]{6,8}$/.test(w))); assert.equal(new Set(SCRAMBLE).size, SCRAMBLE.length);
  assert.ok(MATCH_WORDS.every(w => /^[a-z]{4,20}$/.test(w))); assert.equal(new Set(MATCH_WORDS).size, MATCH_WORDS.length);
  assert.ok(ANSWERS_5.length >= 300 && SCRAMBLE.length >= 90 && MATCH_WORDS.length >= 150);
});
test('the daily word is the same for everyone on a day, changes with the day, and does not repeat within a full cycle', () => {
  assert.equal(dailyAnswer(20000), dailyAnswer(20000)); assert.notEqual(dailyAnswer(20000), dailyAnswer(20001));
  const n = ANSWERS_5.length, seen = new Set<string>(); for (let d = 0; d < n; d++) seen.add(dailyAnswer(20000 - (20000 % n) + d));
  assert.equal(seen.size, n, 'every word appears exactly once per cycle');
});
test('scoring handles repeated letters exactly like the real game', () => {
  assert.deepEqual(scoreGuess('apple', 'apple'), ['correct', 'correct', 'correct', 'correct', 'correct']);
  assert.deepEqual(scoreGuess('apple', 'paper'), ['present', 'present', 'correct', 'present', 'absent']);
  assert.deepEqual(scoreGuess('abbey', 'babes'), ['present', 'present', 'correct', 'correct', 'absent']);
  assert.deepEqual(scoreGuess('crane', 'eerie'), ['absent', 'absent', 'present', 'absent', 'correct']);       // the last e is exact, so the other two e's have no partner left
  assert.deepEqual(scoreGuess('speed', 'erase'), ['present', 'absent', 'absent', 'present', 'present']);
});
test('keyboard shows the best state of each letter, and status follows the guesses', () => {
  const ks = keyStates('apple', ['paper', 'apple']); assert.equal(ks.a, 'correct'); assert.equal(ks.r, 'absent');
  assert.equal(wordStatus('apple', []), 'playing'); assert.equal(wordStatus('apple', ['paper', 'apple']), 'won');
  assert.equal(wordStatus('apple', Array(MAX_TRIES).fill('paper')), 'lost'); assert.equal(wordStatus('apple', Array(MAX_TRIES - 1).fill('paper')), 'playing');
});
test('the share grid shows squares, never letters', () => {
  const g = shareGrid('apple', ['paper', 'apple'], 123); assert.ok(!/[a-z]{3}/.test(g.split('\n').slice(1).join('')) ); assert.match(g, /2\/6/); assert.match(shareGrid('apple', Array(6).fill('paper'), 5), /X\/6/);
});
test('unscramble: five words, always scrambled, same letters, same for everyone', () => {
  for (const d of [1, 2, 3, 20000, 20001]) { const s = dailyScramble(d); assert.equal(s.length, 5); for (const x of s) { assert.notEqual(x.letters.join(''), x.word); assert.equal([...x.letters].sort().join(''), [...x.word].sort().join('')); } }
  assert.deepEqual(dailyScramble(20000), dailyScramble(20000)); assert.notDeepEqual(dailyScramble(20000).map(x => x.word), dailyScramble(20001).map(x => x.word));
});
test('match: five different words a day and a shuffled meaning order', () => {
  for (const d of [1, 2, 20000]) { const m = dailyMatch(d); assert.equal(new Set(m).size, 5); assert.deepEqual([...meaningOrder(d)].sort(), [0, 1, 2, 3, 4]); }
  assert.deepEqual(dailyMatch(20000), dailyMatch(20000));
});

import { freshState, finishPlay, playRef, townView, sanitizeTownEvents, exportEvents, rebuildState, learningDays, playedToday, DAY, PLAY_REWARD } from '../src/index.ts';
test('finishing a puzzle pays once per game per day, only for today, and syncs', () => {
  const now = 1_800_000_000_000, day = Math.floor(now / DAY); const s0 = freshState();
  const a = finishPlay(s0, playRef('word', day), now); assert.ok(a.ok); if (!a.ok) return;
  const v0 = townView(s0, now), v1 = townView(a.state, now); assert.equal(v1.coins - v0.coins, PLAY_REWARD.coins); assert.equal(v1.xp - v0.xp, PLAY_REWARD.xp);
  assert.equal(finishPlay(a.state, playRef('word', day), now + 5).ok, false, 'no second reward for the same puzzle');
  assert.ok(finishPlay(a.state, playRef('match', day), now + 5).ok, 'a different game is a different puzzle');
  assert.equal(finishPlay(s0, playRef('word', day - 5), now).ok, false, 'an old puzzle cannot be claimed today');
  assert.equal(finishPlay(s0, 'nonsense:1', now).ok, false); assert.equal(finishPlay(s0, 'word:abc', now).ok, false);
  assert.deepEqual([...playedToday(a.state, day)], ['word']);
  const ev = exportEvents(a.state); assert.equal(sanitizeTownEvents(ev.town).length, 1); assert.equal(rebuildState(ev).town.filter(e => e.kind === 'play').length, 1);
  assert.equal(sanitizeTownEvents([{ key: 'play:word:5', kind: 'play', ref: 'chess:5', at: 1 }, { key: 'play:x', kind: 'play', ref: 'word:5', at: 1 }]).length, 0, 'forged events are dropped');
  assert.equal(learningDays(a.state, now, 0).total, 1, 'playing a puzzle counts as a learning day');
});

test('unscramble levels: five words each, deterministic, scrambled, and harder levels use longer words', () => {
  const avg = (l: typeof LEVELS[number]) => { const w = dailyScramble(20000, l); assert.equal(w.length, 5); for (const x of w) { assert.notEqual(x.letters.join(''), x.word); assert.equal([...x.letters].sort().join(''), [...x.word].sort().join('')); } return w.reduce((a, x) => a + x.word.length, 0) / 5; };
  assert.ok(avg('easy') < avg('hard')); assert.ok(avg('medium') <= avg('super'));
  assert.deepEqual(dailyScramble(20001, 'hard'), dailyScramble(20001, 'hard'));
  for (const l of LEVELS) assert.notDeepEqual(dailyScramble(20000, l).map(x => x.word), dailyScramble(20001, l).map(x => x.word));
});
test('time and speech helpers', () => {
  assert.equal(formatTime(65_000), '1:05'); assert.equal(formatTime(-5), '0:00'); assert.equal(formatTime(9_999), '0:09');
  assert.ok(heardMatches('serendipity', ['Serendipity.'])); assert.ok(heardMatches('cat', ['bat', ' Cat '])); assert.ok(!heardMatches('cat', ['cot']));
});
