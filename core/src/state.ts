import type { LearnerState, Prefs, SenseRecord } from './types.ts';
import { SENSE_BY_ID } from './fixtures.ts';

export const DAY = 86_400_000;
export const MAX_CONTEXT = 500;
export const defaultPrefs: Prefs = { explainLang: 'hi', textScale: 1, reducedMotion: false, audioFirst: true, simpleMode: true };

export const freshState = (): LearnerState => ({
  version: 2, town: [], prefs: { ...defaultPrefs }, captures: [], senses: {}, attempts: {}, rewards: [], recommendations: [], lastClock: 0,
});

export const newRecord = (senseId: string, at: number): SenseRecord => ({
  senseId, capturedAt: at, stage: 0, due: at, lastAttemptAt: 0, evidence: {}, confusions: {}, lastActivityId: null,
});

export interface RestoreResult { state: LearnerState; recovered: 'ok' | 'migrated' | 'reset'; }

/** Restores saved JSON. Corrupt data yields a fresh state and says so, never a thrown error. */
export function restore(raw: string | null | undefined): RestoreResult {
  if (!raw) return { state: freshState(), recovered: 'ok' };
  try {
    const s = JSON.parse(raw);
    if (s?.version === 2) {
      if (!Array.isArray(s.captures) || typeof s.senses !== 'object' || s.senses === null || typeof s.attempts !== 'object') throw 0;
      return { state: { ...freshState(), ...s, prefs: { ...defaultPrefs, ...s.prefs } }, recovered: 'ok' };
    }
    if (s?.version === 1) return { state: migrateV1(s), recovered: 'migrated' };
    throw 0;
  } catch {
    return { state: freshState(), recovered: 'reset' };
  }
}

/** v1 = prototype save: { xp, words:[{word, context, source, added, stage, due}], mode, large, motion }. */
export function migrateV1(v1: any): LearnerState {
  if (!Array.isArray(v1.words) || v1.words.length > 10_000) throw 0;
  const out = freshState();
  out.prefs.textScale = v1.large ? 1.25 : 1;
  out.prefs.reducedMotion = v1.motion === false;
  for (const w of v1.words) {
    const word = String(w.word ?? '').toLowerCase();
    if (!word) continue;
    const at = Number.isFinite(w.added) ? w.added : 0;
    // v1 was keyed by bare word: map to the first fixture sense if any, otherwise keep as pending. Nothing is lost.
    const sense = Object.values(SENSE_BY_ID).find(x => x.lemma === word);
    const ctx = String(w.context ?? '').slice(0, MAX_CONTEXT);
    if (sense && !out.senses[sense.senseId]) {
      out.senses[sense.senseId] = { ...newRecord(sense.senseId, at), stage: Math.min(5, Math.max(0, w.stage | 0)), due: Number.isFinite(w.due) ? w.due : at };
      out.captures.push({ query: word, senseId: sense.senseId, context: ctx, source: String(w.source ?? 'Other').slice(0, 80), at, status: 'resolved' });
    } else if (!sense) {
      out.captures.push({ query: word, senseId: null, context: ctx, source: String(w.source ?? 'Other').slice(0, 80), at, status: 'pending' });
    }
  }
  return out;
}

export const serialize = (s: LearnerState) => JSON.stringify(s);
export const dayIndex = (t: number, tzOffsetMin = 0) => Math.floor((t + tzOffsetMin * 60_000) / DAY);
