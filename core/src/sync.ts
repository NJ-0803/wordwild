import type { Attempt, Capture, LearnerState, Prefs, TownEvent } from './types.ts';
import { SENSE_BY_ID } from './fixtures.ts';
import { capture, submitAttempt } from './engine.ts';
import type { LookupResult } from './dictionary.ts';
import { defaultPrefs, freshState } from './state.ts';
import { isSenseId } from './validate.ts';
import { sanitizeProfile } from './level.ts';
import { applyTownEvent, sanitizeTownEvents } from './town.ts';
import type { Sense } from './types.ts';

/**
 * Sync model: captures and attempts are grow-only event sets. Two devices can never conflict because
 * union is commutative, and every attempt carries an idempotency key. State is always REBUILT from
 * events by the same engine used locally, so rewards and mastery cannot be forged or duplicated by sync.
 */
export interface SyncEvents { captures: Capture[]; attempts: Attempt[]; town?: TownEvent[] }

export const captureKey = (c: Capture) => c.senseId ?? `pending:${c.query}`;

export function exportEvents(s: LearnerState): SyncEvents {
  return { captures: s.captures, attempts: Object.values(s.attempts), town: s.town };
}

/** Union of two event sets. A resolved capture supersedes a pending one for the same word. */
export function mergeEvents(a: SyncEvents, b: SyncEvents): SyncEvents {
  const caps = new Map<string, Capture>();
  for (const c of [...a.captures, ...b.captures]) {
    const k = captureKey(c); const have = caps.get(k);
    if (!have || c.at < have.at) caps.set(k, c);      // earliest wins: stable across devices
  }
  const resolved = new Set([...caps.values()].filter(c => c.senseId).map(c => c.query));
  const captures = [...caps.values()].filter(c => c.senseId || !resolved.has(c.query)).sort((x, y) => x.at - y.at || captureKey(x).localeCompare(captureKey(y)));
  const att = new Map<string, Attempt>();
  for (const x of [...a.attempts, ...b.attempts]) if (!att.has(x.key)) att.set(x.key, x);
  const attempts = [...att.values()].sort((x, y) => x.at - y.at || x.key.localeCompare(y.key));
  const tw = new Map<string, TownEvent>();
  for (const e of [...(a.town ?? []), ...(b.town ?? [])]) { const have = tw.get(e.key); if (!have || e.at < have.at) tw.set(e.key, e); }
  const town = [...tw.values()].sort((x, y) => x.at - y.at || x.key.localeCompare(y.key));
  return { captures, attempts, town };
}

/** Deterministic rebuild: the same event set always yields the same state, on any device. */
export function rebuildState(events: SyncEvents, prefs: Prefs = defaultPrefs): LearnerState {
  let s: LearnerState = { ...freshState(), prefs: { ...defaultPrefs, ...prefs } };
  const m = mergeEvents(events, { captures: [], attempts: [] });
  // One chronological pass: the engine's clock never moves backwards, so replaying all captures first
  // would drag attempts forward in time and change the schedule.
  const timeline = [
    ...m.captures.map(c => ({ at: c.at, order: 0, c, a: null as Attempt | null, t: null as TownEvent | null })),
    ...m.attempts.map(a => ({ at: a.at, order: 1, c: null as Capture | null, a, t: null as TownEvent | null })),
    ...(m.town ?? []).map(t => ({ at: t.at, order: 2, c: null as Capture | null, a: null as Attempt | null, t })),
  ].sort((x, y) => x.at - y.at || x.order - y.order);
  for (const ev of timeline) {
    if (ev.c) {
      const c = ev.c;
      // Dictionary senses are not bundled: the id is enough for the engine. Malformed ids are skipped, never invented.
      const sense = c.senseId ? (SENSE_BY_ID[c.senseId] ?? (isSenseId(c.senseId) && c.senseId.includes('%') ? ({ senseId: c.senseId, lemma: c.query } as Sense) : undefined)) : undefined;
      if (c.senseId && !sense) continue;
      const result: LookupResult = sense ? { status: 'found', senses: [sense], source: 'sync' }
        : c.status === 'unknown' ? { status: 'unknown', query: c.query } : { status: 'pending', query: c.query, reason: 'synced' };
      s = capture(s, result, { context: c.context, source: c.source, senseId: c.senseId ?? undefined, now: c.at }).state;
    } else if (ev.a) {
      try { s = submitAttempt(s, ev.a).state; } catch { /* attempt for a word this account has not captured: ignore */ }
    } else if (ev.t) {
      s = applyTownEvent(s, ev.t);           // a build or claim only counts if it was affordable / earned at that moment
    }
  }
  return s;
}

const SKILLS = ['listening', 'reading', 'meaning', 'recall', 'usage'];
const ERRS = ['meaning', 'grammar', 'register', 'unusual', 'sense-confusion'];
const str = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
export const LIMITS = { attemptsPerRequest: 500, capturesPerRequest: 200 };

/** Server-side validation of untrusted client events. Returns only well-formed items. */
export function sanitizeEvents(raw: any): SyncEvents {
  const captures: Capture[] = []; const attempts: Attempt[] = [];
  const town = sanitizeTownEvents(raw?.town);
  for (const c of (Array.isArray(raw?.captures) ? raw.captures : []).slice(0, LIMITS.capturesPerRequest)) {
    if (!str(c?.query, 48) || !c.query || !str(c?.context ?? '', 500) || !str(c?.source ?? '', 80) || !Number.isFinite(c?.at)) continue;
    if (!['resolved', 'pending', 'unknown'].includes(c.status)) continue;
    if (c.senseId !== null && !(isSenseId(c.senseId) && (SENSE_BY_ID[c.senseId] || c.senseId.includes('%')))) continue;
    captures.push({ query: c.query, senseId: c.senseId ?? null, context: c.context ?? '', source: c.source ?? 'Other', at: c.at, status: c.status });
  }
  for (const a of (Array.isArray(raw?.attempts) ? raw.attempts : []).slice(0, LIMITS.attemptsPerRequest)) {
    if (!str(a?.key, 120) || !a.key || !isSenseId(a?.senseId) || !(SENSE_BY_ID[a.senseId] || a.senseId.includes('%')) || !str(a?.activityId, 80)) continue;
    if (!SKILLS.includes(a.skill) || !(a.correct === true || a.correct === false || a.correct === null)) continue;
    if (!Number.isInteger(a.hintsUsed) || a.hintsUsed < 0 || a.hintsUsed > 20 || !Number.isFinite(a.at)) continue;
    if (a.errorType !== null && !ERRS.includes(a.errorType)) continue;
    attempts.push({ key: a.key, senseId: a.senseId, activityId: a.activityId, skill: a.skill, correct: a.correct, hintsUsed: a.hintsUsed, errorType: a.errorType ?? null, at: a.at });
  }
  return { captures, attempts, town };
}

export function sanitizePrefs(raw: any): Prefs | null {
  if (!raw || typeof raw !== 'object') return null;
  const langs = ['en', 'hi', 'pa'];
  if (!langs.includes(raw.explainLang) || !Number.isFinite(raw.textScale) || raw.textScale < 0.75 || raw.textScale > 2) return null;
  return { explainLang: raw.explainLang, textScale: raw.textScale, reducedMotion: !!raw.reducedMotion, audioFirst: !!raw.audioFirst, simpleMode: !!raw.simpleMode, profile: sanitizeProfile(raw.profile) };
}
