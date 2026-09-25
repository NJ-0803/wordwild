import type { Attempt, LearnerState, RewardEntry, Sense, SenseRecord, Skill, SkillEvidence } from './types.ts';
import type { LookupResult } from './dictionary.ts';
import { normalizeQuery } from './dictionary.ts';
import { DAY, MAX_CONTEXT, dayIndex, newRecord } from './state.ts';

/** Heuristic initial intervals (days). Product guesses, not proven optimal; tune with real data. */
export const INTERVALS_DAYS = [1, 3, 7, 21, 60];
export const RETRY_MS = 10 * 60_000;
export const DISCOVERY_POINTS = 5;
export const STAGE_POINTS = 10;
export const SECURE_POINTS = 30;
export const DAILY_MASTERY_CAP = 100;
/** Saving words pays, but only for the first 8 a day: coins can not be farmed by saving a whole dictionary. The words are still saved. */
export const DAILY_DISCOVERY_CAP = 40;
/** Coming back after a break is met with a small gift, never a penalty. Paid once per returning day. */
export const WELCOME_BACK_DAYS = 3;
export const WELCOME_POINTS = 15;

/** Device clocks can go backwards; never let time move before what we already saw. */
const effectiveNow = (s: LearnerState, now: number) => Math.max(now, s.lastClock);

export type CaptureOutcome = 'saved' | 'needs-sense' | 'duplicate' | 'pending' | 'unknown';

export function capture(
  state: LearnerState, result: LookupResult,
  o: { context?: string; source?: string; senseId?: string; now: number },
): { state: LearnerState; outcome: CaptureOutcome } {
  const now = effectiveNow(state, o.now);
  const context = String(o.context ?? '').slice(0, MAX_CONTEXT);
  const source = String(o.source ?? 'Other').slice(0, 80);
  const query = result.status === 'found' ? normalizeQuery(result.senses[0].lemma) : result.query;

  if (result.status === 'found') {
    if (result.senses.length > 1 && !o.senseId) return { state, outcome: 'needs-sense' };   // never guess a sense
    const sense = o.senseId ? result.senses.find(s => s.senseId === o.senseId) : result.senses[0];
    if (!sense) return { state, outcome: 'needs-sense' };
    if (state.senses[sense.senseId]) return { state, outcome: 'duplicate' };
    let next: LearnerState = {
      ...welcomeBack(state, now), lastClock: now,
      // an earlier pending capture for the same word is upgraded rather than duplicated
      captures: [...state.captures.filter(c => !(c.status !== 'resolved' && c.query === query)),
        { query, senseId: sense.senseId, context: context || (state.captures.find(c => c.query === query)?.context ?? ''), source, at: now, status: 'resolved' }],
      senses: { ...state.senses, [sense.senseId]: newRecord(sense.senseId, now) },
    };
    next = addReward(next, `discovery:${sense.senseId}`, 'discovery', DISCOVERY_POINTS, now);
    return { state: next, outcome: 'saved' };
  }
  if (state.captures.some(c => c.query === query && c.status !== 'resolved')) return { state, outcome: 'duplicate' };
  const status = result.status === 'unknown' ? 'unknown' : 'pending';
  return {
    state: { ...state, lastClock: now, captures: [...state.captures, { query, senseId: null, context, source, at: now, status }] },
    outcome: status,
  };
}

/** A gift for returning after a gap of a few days. Nothing is ever taken away for being away. */
function welcomeBack(s: LearnerState, now: number): LearnerState {
  const started = s.lastClock > 0 && (s.captures.length > 0 || Object.keys(s.attempts).length > 0);
  if (!started || now - s.lastClock < WELCOME_BACK_DAYS * DAY) return s;
  return addReward(s, `welcome:${dayIndex(now, 0)}`, 'welcome', WELCOME_POINTS, now);
}

function addReward(s: LearnerState, key: string, kind: RewardEntry['kind'], points: number, at: number, tz = 0): LearnerState {
  if (s.rewards.some(r => r.key === key)) return s;                        // never pay twice for the same thing
  const cap = kind === 'mastery' ? DAILY_MASTERY_CAP : kind === 'discovery' ? DAILY_DISCOVERY_CAP : Infinity;
  if (cap !== Infinity) {
    const day = dayIndex(at, tz);
    const today = s.rewards.filter(r => r.kind === kind && dayIndex(r.at, tz) === day).reduce((n, r) => n + r.points, 0);
    points = Math.max(0, Math.min(points, cap - today));
    if (points === 0) return s;
  }
  return { ...s, rewards: [...s.rewards, { key, kind, points, at }] };
}

const emptyEv = (): SkillEvidence => ({ correct: 0, incorrect: 0, independentCorrect: 0, assisted: 0, distinctActivities: [], lastAt: 0, lastCorrect: false });

export interface AttemptResult { state: LearnerState; duplicate: boolean; stageAdvanced: boolean; nextDue: number | null; }

/** Idempotent: resubmitting the same key (offline retry) is a no-op. */
export function submitAttempt(state: LearnerState, a: Attempt): AttemptResult {
  if (state.attempts[a.key]) return { state, duplicate: true, stageAdvanced: false, nextDue: state.senses[a.senseId]?.due ?? null };
  const rec = state.senses[a.senseId];
  if (!rec) throw new Error('Capture the word before practising it.');
  const now = effectiveNow(state, a.at);
  const attempt: Attempt = { ...a, at: now };

  if (a.correct === null) {          // uncertain feedback: keep the record, change nothing else
    return { state: { ...state, lastClock: now, attempts: { ...state.attempts, [a.key]: attempt }, senses: { ...state.senses, [a.senseId]: { ...rec, lastActivityId: a.activityId } } }, duplicate: false, stageAdvanced: false, nextDue: rec.due };
  }

  const independent = a.hintsUsed === 0;
  const ev = { ...(rec.evidence[a.skill] ?? emptyEv()) };
  ev.lastAt = now; ev.lastCorrect = a.correct;
  if (a.correct) {
    ev.correct++;
    if (independent) ev.independentCorrect++; else ev.assisted++;
    if (!ev.distinctActivities.includes(a.activityId)) ev.distinctActivities = [...ev.distinctActivities, a.activityId];
  } else ev.incorrect++;

  const eligible = now >= rec.due;
  const advance = a.correct && independent && eligible && rec.stage < INTERVALS_DAYS.length;
  let stage = rec.stage, due = rec.due;
  if (advance) { due = now + INTERVALS_DAYS[rec.stage] * DAY; stage = rec.stage + 1; }
  else if (a.correct && !independent) due = Math.min(rec.due, now + DAY);        // assisted: come back soon, no stage
  else if (!a.correct) due = Math.min(rec.due, now + RETRY_MS);                  // soft retry; stage is never lowered

  const confusions = { ...rec.confusions };
  if (!a.correct && a.errorType) confusions[a.errorType] = (confusions[a.errorType] ?? 0) + 1;
  const newRec: SenseRecord = { ...rec, stage, due, lastAttemptAt: now, lastActivityId: a.activityId, confusions, evidence: { ...rec.evidence, [a.skill]: ev } };

  let next: LearnerState = { ...welcomeBack(state, now), lastClock: now, attempts: { ...state.attempts, [a.key]: attempt }, senses: { ...state.senses, [a.senseId]: newRec } };
  if (advance) next = addReward(next, `mastery:stage:${a.senseId}:${stage}`, 'mastery', STAGE_POINTS, now);
  if (masteryLevel(newRec) === 'secure') next = addReward(next, `mastery:secure:${a.senseId}`, 'mastery', SECURE_POINTS, now);
  return { state: next, duplicate: false, stageAdvanced: advance, nextDue: due };
}

export type MasteryLevel = 'new' | 'seen' | 'practising' | 'secure';

/**
 * Discovery is not mastery, and one correct recognition is not mastery. "Secure" needs independent
 * success in >= 2 skills including recall or usage, currently correct, and at least one spaced review passed.
 */
export function masteryLevel(r: SenseRecord): MasteryLevel {
  const ev = Object.entries(r.evidence) as [Skill, SkillEvidence][];
  if (ev.length === 0) return r.lastAttemptAt ? 'seen' : 'new';
  const good = ev.filter(([, e]) => e.independentCorrect >= 1 && e.lastCorrect);
  const hasActive = good.some(([k]) => k === 'recall' || k === 'usage');
  if (good.length >= 2 && hasActive && r.stage >= 2) return 'secure';
  return ev.some(([, e]) => e.correct > 0) ? 'practising' : 'seen';
}

/** Story/world progress is derived from evidence, never stored separately, so it cannot drift or be farmed. */
export function worldProgress(state: LearnerState) {
  const levels = Object.values(state.senses).map(masteryLevel);
  const secure = levels.filter(l => l === 'secure').length;
  const practising = levels.filter(l => l === 'practising').length;
  const points = state.rewards.reduce((n, r) => n + r.points, 0);
  return { discovered: levels.length, practising, secure, points, growthStage: Math.min(3, Math.floor(secure / 2) + (practising > 0 || secure > 0 ? 1 : 0)) };
}

export const dueSenses = (s: LearnerState, now: number) =>
  Object.values(s.senses).filter(r => r.lastAttemptAt > 0 && r.due <= effectiveNow(s, now)).sort((a, b) => a.due - b.due);

export type { Sense };
