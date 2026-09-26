import { ANSWERS_5, MATCH_WORDS, SCRAMBLE, SCRAMBLE_HARD, SCRAMBLE_MEDIUM, SCRAMBLE_SUPER } from './playwords.ts';

/**
 * Daily puzzles. Pure and deterministic: the same day gives every learner the same puzzle, so people can talk about it, and nothing here
 * stores or punishes anything. Finishing a puzzle is celebrated (see town.ts finishPlay); not finishing costs nothing.
 */
export const GAMES = ['word', 'unscramble', 'match'] as const;
export type Game = (typeof GAMES)[number];
export const GAME_LABEL: Record<Game, { title: string; blurb: string }> = {
  word: { title: 'Word of the Day', blurb: 'Guess the five-letter word in six tries.' },
  unscramble: { title: 'Unscramble', blurb: 'Put the letters back in order. The meaning is your clue.' },
  match: { title: 'Meaning Match', blurb: 'Pair each word with what it means.' },
};
export const PLAY_POINTS = 2;

// A small, seedable generator (mulberry32) so puzzles never depend on the browser's random numbers.
function playRng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffled<T>(list: readonly T[], seed: number): T[] { const r = playRng(seed), a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** The word for a day. Each pass through the list is a fresh shuffle, so no word repeats until the whole list has been used. */
export function dailyAnswer(day: number): string { const n = ANSWERS_5.length, cycle = Math.floor(day / n); return shuffled(ANSWERS_5, 7919 + cycle)[((day % n) + n) % n]; }

export type Mark = 'correct' | 'present' | 'absent';
/** Wordle scoring, with repeated letters handled properly: a letter is only marked "present" as many times as the answer really has it. */
export function scoreGuess(answer: string, guess: string): Mark[] {
  const a = answer.toLowerCase(), g = guess.toLowerCase(), out: Mark[] = Array(g.length).fill('absent'); const left: Record<string, number> = {};
  for (let i = 0; i < g.length; i++) { if (g[i] === a[i]) out[i] = 'correct'; else left[a[i]] = (left[a[i]] ?? 0) + 1; }
  for (let i = 0; i < g.length; i++) if (out[i] === 'absent' && (left[g[i]] ?? 0) > 0) { out[i] = 'present'; left[g[i]]--; }
  return out;
}
/** Best known state of each letter, for the on-screen keyboard. */
export function keyStates(answer: string, guesses: string[]): Record<string, Mark> {
  const rank: Record<Mark, number> = { absent: 0, present: 1, correct: 2 }; const out: Record<string, Mark> = {};
  for (const g of guesses) scoreGuess(answer, g).forEach((m, i) => { const l = g[i].toLowerCase(); if (!out[l] || rank[m] > rank[out[l]]) out[l] = m; });
  return out;
}
export const MAX_TRIES = 6;
export type WordStatus = 'playing' | 'won' | 'lost';
export const wordStatus = (answer: string, guesses: string[]): WordStatus => (guesses.some(g => g.toLowerCase() === answer.toLowerCase()) ? 'won' : guesses.length >= MAX_TRIES ? 'lost' : 'playing');
/** Shareable result: squares only, never the letters, so it does not spoil the puzzle. */
export const shareGrid = (answer: string, guesses: string[], day: number) => `Wordwild word ${day} ${wordStatus(answer, guesses) === 'won' ? guesses.length : 'X'}/${MAX_TRIES}\n${guesses.map(g => scoreGuess(answer, g).map(m => (m === 'correct' ? '🟦' : m === 'present' ? '🔹' : '⬛')).join('')).join('\n')}`;

/** Unscramble difficulty. Each level has its own words, its own clue and its own time. */
export const LEVELS = ['easy', 'medium', 'hard', 'super'] as const;
export type Level = (typeof LEVELS)[number];
export const LEVEL_LABEL: Record<Level, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', super: 'Super hard' };
const LEVEL_WORDS: Record<Level, readonly string[]> = { easy: SCRAMBLE, medium: SCRAMBLE_MEDIUM, hard: SCRAMBLE_HARD, super: SCRAMBLE_SUPER };

/** Five words for Unscramble at a level, with letters scrambled (never left in the right order). */
export function dailyScramble(day: number, level: Level = 'easy'): { word: string; letters: string[] }[] {
  const list = LEVEL_WORDS[level], salt = LEVELS.indexOf(level) * 7;
  const groups = Math.max(1, Math.floor(list.length / 5));
  const words = shuffled(list, 104729 + salt + Math.floor(day / groups)).slice((day % groups) * 5, (day % groups) * 5 + 5);
  return words.map((w, i) => { let l = shuffled([...w], day * 31 + i * 7 + 1 + salt); for (let k = 2; l.join('') === w && k < 12; k++) l = shuffled([...w], day * 31 + i * 7 + k + salt); return { word: w, letters: l }; });
}

/** "1:05" for 65 seconds. Whole seconds; hours are never needed for a puzzle. */
export const formatTime = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/** What was said, reduced to letters, so "Serendipity." or " serendipity " match. */
export const spokenWord = (t: string) => String(t ?? '').toLowerCase().replace(/[^a-z]/g, '');
/** Does any of the things the speech recogniser heard match the target? */
export const heardMatches = (target: string, heard: string[]) => heard.some(h => spokenWord(h) === spokenWord(target));
/** Five learner words for Meaning Match. */
export function dailyMatch(day: number): string[] { return shuffled(MATCH_WORDS, 15485863 + Math.floor(day / 5)).slice((day % 5) * 5, (day % 5) * 5 + 5); }
/** The meanings in a different order from the words, so position gives nothing away. */
export function meaningOrder(day: number): number[] { return shuffled([0, 1, 2, 3, 4], day * 17 + 3); }
