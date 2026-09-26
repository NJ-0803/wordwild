import type { LearnerState } from './types.ts';
import { masteryLevel } from './engine.ts';

/**
 * Anonymous product measurement, designed to collect as little as possible.
 *  - An event is only a NAME from a fixed list plus, for two events, one label from a fixed list. Never a word, sentence, name, email, address or page.
 *  - It is tied to a random per-device id (no account id), so it cannot be linked to a person, and the person can reset or switch it off.
 *  - The server rejects anything not on these lists, so a bug or an attacker cannot make it store free text.
 */
export const METRIC_EVENTS = ['app_open', 'word_saved', 'practice_done', 'word_secure', 'scene_finished', 'journey_complete', 'share_card', 'coach_seen', 'lookup', 'first_word', 'first_review', 'review_done', 'recall_unassisted', 'recall_assisted', 'recall_forgot'] as const;
export type MetricName = (typeof METRIC_EVENTS)[number];

/** The only labels allowed, per event. Everything else is refused. */
const LABELS: Partial<Record<MetricName, readonly string[]>> = {
  lookup: ['found', 'found-form', 'unknown', 'unknown-suggested', 'empty', 'too-long', 'sentence', 'digits', 'url', 'non-latin', 'acronym', 'contraction', 'symbols'],
  share_card: ['word', 'vault'],
  first_word: ['lt30s', 'lt60s', 'lt3m', 'slower'],        // how long after the first visit the first word was saved
};
/** Which bucket a time-to-first-word falls in. */
export const firstWordBucket = (ms: number) => (ms < 30_000 ? 'lt30s' : ms < 60_000 ? 'lt60s' : ms < 180_000 ? 'lt3m' : 'slower');
export interface Metric { name: MetricName; label?: string }

export function sanitizeMetric(raw: unknown): Metric | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { name?: unknown; label?: unknown };
  if (typeof r.name !== 'string' || !(METRIC_EVENTS as readonly string[]).includes(r.name)) return null;
  const name = r.name as MetricName; const allowed = LABELS[name];
  if (r.label === undefined || r.label === null) return { name };
  if (!allowed || typeof r.label !== 'string' || !allowed.includes(r.label)) return null;
  return { name, label: r.label };
}
export const sanitizeDevice = (d: unknown): string | null => (typeof d === 'string' && /^[a-z0-9]{16,40}$/.test(d) ? d : null);

/** Counts that only ever go up as the learner learns. Comparing two of these tells us what just happened, without reading any content. */
export interface Counts { saved: number; practised: number; secure: number; scenes: number }
export function counts(s: LearnerState): Counts {
  const recs = Object.values(s.senses);
  return { saved: recs.length, practised: Object.keys(s.attempts).length, secure: recs.filter(r => masteryLevel(r) === 'secure').length, scenes: s.town.filter(e => e.kind === 'scene').length };
}
export function deltaEvents(a: Counts, b: Counts): Metric[] {
  const out: Metric[] = [];
  const rep = (name: MetricName, n: number) => { for (let i = 0; i < Math.min(n, 5); i++) out.push({ name }); };
  rep('word_saved', b.saved - a.saved); rep('practice_done', b.practised - a.practised); rep('word_secure', b.secure - a.secure); rep('scene_finished', b.scenes - a.scenes);
  return out;
}
