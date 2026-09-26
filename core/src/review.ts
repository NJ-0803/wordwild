import type { Attempt, LearnerState } from './types.ts';

/**
 * The daily review session: words that are due, one at a time, rated honestly by the learner ("I know it", "Almost", "I forgot").
 * Self-rating is weaker evidence than a checked question, so it is recorded as such:
 *  - "I know it" counts as an independent correct recall, and can bring the word back later;
 *  - "Almost" counts as assisted (it never advances the schedule);
 *  - "I forgot" counts as incorrect and the word comes back sooner.
 * A single activity id is used, so self-review alone can never make a word "secure": that still takes different kinds of practice.
 */
export type Rating = 'know' | 'almost' | 'forgot';
export const RATING_LABEL: Record<Rating, string> = { know: 'I know it', almost: 'Almost', forgot: 'I forgot' };
export const REVIEW_ACTIVITY = 'self-review';

/** Ripe words first (most overdue first), then at most one word that was saved but never practised. */
export function reviewQueue(state: LearnerState, now: number, limit = 5): string[] {
  const recs = Object.values(state.senses);
  const ripe = recs.filter(r => r.lastAttemptAt > 0 && r.due <= now).sort((a, b) => a.due - b.due).map(r => r.senseId);
  const fresh = recs.filter(r => r.lastAttemptAt === 0).sort((a, b) => a.capturedAt - b.capturedAt).map(r => r.senseId);
  return [...ripe.slice(0, limit), ...(ripe.length < limit ? fresh.slice(0, 1) : [])].slice(0, limit);
}

export function ratingAttempt(senseId: string, rating: Rating, key: string, at: number): Attempt {
  return { key, senseId, activityId: REVIEW_ACTIVITY, skill: 'recall', correct: rating !== 'forgot', hintsUsed: rating === 'almost' ? 1 : 0, errorType: null, at };
}

export interface ReviewSummary { total: number; know: number; almost: number; forgot: number; headline: string }
export function reviewSummary(ratings: Rating[]): ReviewSummary {
  const c = { know: 0, almost: 0, forgot: 0 }; for (const r of ratings) c[r]++;
  const total = ratings.length;
  const headline = total === 0 ? 'Nothing to review today.' : c.forgot === 0 ? 'Every word came back to you.' : c.know + c.almost === 0 ? 'These words will come back sooner, which is exactly how memory is built.' : 'Good session. The ones you missed will return sooner.';
  return { total, ...c, headline };
}
