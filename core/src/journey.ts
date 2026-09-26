import type { LearnerState } from './types.ts';
import { dayIndex, DAY } from './state.ts';
import { masteryLevel } from './engine.ts';
import { townView } from './town.ts';
import { pickDaily, type DailyPick } from './daily.ts';

/**
 * Habit without shame. Everything here is DERIVED from events the learner already made (saves, practice, scenes), so it needs no
 * new stored state, syncs for free, and can never be "lost":
 *  - learning days only ever go up; a week view shows days as filled or empty, never as failure;
 *  - "days in a row" is shown only when it is 2 or more, and never as something that can be broken;
 *  - milestones are achievements that stay achieved.
 */

export interface LearningDays {
  total: number;
  /** The last 7 days ending today, oldest first: true = learned that day. */
  week: { day: number; learned: boolean; today: boolean }[];
  /** Consecutive learning days ending today or yesterday. Only worth showing when 2 or more. */
  inARow: number;
  best: number;
}

/** Local day indexes on which the learner did something real: saved a word, practised, or finished a scene. */
export function learningDayIndexes(state: LearnerState, tz: number): number[] {
  const at: number[] = [...state.captures.map(c => c.at), ...Object.values(state.attempts).map(a => a.at), ...state.town.filter(e => e.kind === 'scene' || e.kind === 'play').map(e => e.at)];
  return [...new Set(at.filter(t => t > 0).map(t => dayIndex(t, tz)))].sort((a, b) => a - b);
}

export function learningDays(state: LearnerState, now: number, tz: number): LearningDays {
  const days = learningDayIndexes(state, tz); const set = new Set(days); const today = dayIndex(now, tz);
  let best = 0, run = 0, prev = -Infinity;
  for (const d of days) { run = d === prev + 1 ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  let inARow = 0; let d = set.has(today) ? today : today - 1;               // a day that has not happened yet never counts against you
  while (set.has(d)) { inARow++; d--; }
  return { total: days.length, week: Array.from({ length: 7 }, (_, i) => { const day = today - 6 + i; return { day, learned: set.has(day), today: day === today }; }), inARow, best };
}

export interface Milestone { id: string; title: string; detail: string; done: boolean; have: number; need: number }

/** A gentle ladder of achievements. `next` is the nearest one not yet reached. */
export function milestones(state: LearnerState, now: number, tz: number): { all: Milestone[]; next: Milestone | null; doneCount: number } {
  const saved = Object.keys(state.senses).length;
  const recs = Object.values(state.senses);
  const practised = recs.filter(r => r.lastAttemptAt > 0).length;
  const secure = recs.filter(r => masteryLevel(r) === 'secure').length;
  const scenes = state.town.filter(e => e.kind === 'scene').length;
  const built = state.town.filter(e => e.kind === 'build').length;
  const days = learningDays(state, now, tz);
  const level = townView(state, now, tz).level;
  const m = (id: string, title: string, detail: string, have: number, need: number): Milestone => ({ id, title, detail, have: Math.min(have, need), need, done: have >= need });
  const all = [
    m('first-word', 'First word', 'Save your first word.', saved, 1),
    m('first-practice', 'First practice', 'Practise a word for the first time.', practised, 1),
    m('five-words', 'Five words', 'Save five words.', saved, 5),
    m('first-secure', 'A word you own', 'Make your first word secure: you can really use it.', secure, 1),
    m('first-scene', 'First story', 'Finish a story scene in your town.', scenes, 1),
    m('three-days', 'Three learning days', 'Learn on three different days. They do not need to be in a row.', days.total, 3),
    m('first-building', 'First building', 'Build something new in your town.', built, 1),
    m('ten-words', 'Ten words', 'Save ten words.', saved, 10),
    m('five-secure', 'Five words you own', 'Make five words secure.', secure, 5),
    m('level-5', 'Level 5', 'Reach level 5 in your town.', level, 5),
    m('seven-days', 'Seven learning days', 'Learn on seven different days.', days.total, 7),
    m('all-scenes', 'Every story', 'Finish every story scene.', scenes, 7),
    m('twenty-five', 'Twenty-five words', 'Save twenty-five words.', saved, 25),
    m('ten-secure', 'Ten words you own', 'Make ten words secure.', secure, 10),
    m('thirty-days', 'Thirty learning days', 'Learn on thirty different days.', days.total, 30),
    m('fifty-secure', 'Fifty words you own', 'Make fifty words secure.', secure, 50),
  ];
  return { all, next: all.find(x => !x.done) ?? null, doneCount: all.filter(x => x.done).length };
}

// ---------------------------------------------------------------------------------------------------------------------
export interface JourneyStep { id: 'meet' | 'try' | 'use'; label: string; hint: string; done: boolean }
export interface DailyJourney { pick: DailyPick; steps: JourneyStep[]; complete: boolean; doneCount: number }

/**
 * Today's small path for ONE word: meet it, practise it, use it in your own words. Progress is read from real events made today,
 * so nothing can be ticked by tapping. Finishing is celebrated; not finishing costs nothing and tomorrow starts fresh.
 */
export function dailyJourney(state: LearnerState, now: number, tz: number, freshCandidates: { senseId: string; lemma: string; from: string }[] = []): DailyJourney {
  const today = dayIndex(now, tz);
  // The journey word must not change while you work: once you practise it, it is no longer "due", so a fresh pick would jump to another
  // word. So the word you first touched today (saved or practised) is today's word; only if you have touched none do we suggest one.
  const touched = [
    ...state.captures.filter(c => c.senseId && dayIndex(c.at, tz) === today).map(c => ({ id: c.senseId as string, at: c.at })),
    ...Object.values(state.attempts).filter(a => dayIndex(a.at, tz) === today).map(a => ({ id: a.senseId, at: a.at })),
  ].filter(t => state.senses[t.id]).sort((a, b) => a.at - b.at)[0];
  const pick: DailyPick = touched ? { kind: state.senses[touched.id].lastAttemptAt === 0 ? 'first' : 'review', senseId: touched.id } : pickDaily(state, now, tz, freshCandidates);
  const id = pick.senseId;
  const attemptsToday = id ? Object.values(state.attempts).filter(a => a.senseId === id && dayIndex(a.at, tz) === today) : [];
  const steps: JourneyStep[] = [
    { id: 'meet', label: 'Meet the word', hint: 'Save it and read what it means.', done: !!id && !!state.senses[id] },
    { id: 'try', label: 'Practise it', hint: 'Answer one question about it.', done: attemptsToday.length > 0 },
    { id: 'use', label: 'Use it in your own words', hint: 'Explain it or write your own sentence.', done: attemptsToday.some(a => a.skill === 'usage') },
  ];
  const doneCount = steps.filter(s => s.done).length;
  return { pick, steps, complete: !!id && doneCount === steps.length, doneCount };
}

// ---------------------------------------------------------------------------------------------------------------------
export interface Vault {
  /** Ripe words: harvest them. */ review: string[];
  /** Saved but never practised. */ fresh: string[];
  /** In progress and resting. */ learning: string[];
  /** Secure: yours. */ mastered: string[];
  /** Saved but not in the dictionary yet. */ pending: string[];
  /** Words that come due on each of the next 7 days (index 0 = today, including everything already ripe). */ schedule: number[];
  total: number;
}

/** My Word Vault: every saved word in exactly one group, plus a revision schedule for the week ahead. */
export function vault(state: LearnerState, now: number, tz: number): Vault {
  const v: Vault = { review: [], fresh: [], learning: [], mastered: [], pending: [], schedule: Array(7).fill(0), total: 0 };
  const today = dayIndex(now, tz);
  for (const r of Object.values(state.senses).sort((a, b) => a.due - b.due)) {
    v.total++;
    if (r.lastAttemptAt === 0) { v.fresh.push(r.senseId); continue; }
    if (r.due <= now) v.review.push(r.senseId);                       // ripe: harvest it (also true for secure words coming round again)
    else if (masteryLevel(r) === 'secure') v.mastered.push(r.senseId);
    else v.learning.push(r.senseId);
    const off = Math.max(0, dayIndex(r.due, tz) - today); if (off < 7) v.schedule[off]++;
  }
  v.pending = state.captures.filter(c => c.status !== 'resolved').map(c => c.query);
  v.total += v.pending.length;
  return v;
}
