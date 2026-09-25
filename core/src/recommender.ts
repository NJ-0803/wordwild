import type { LearnerState, Recommendation, Sense } from './types.ts';
import { DAY } from './state.ts';
import { dueSenses, masteryLevel } from './engine.ts';

/**
 * Explainable policy, evaluated in order:
 *  1. Reviews that are due (most overdue first).
 *  2. Words just captured but not yet practised.
 *  3. New words: related to what the learner recently worked on, prerequisites first, challenge near demonstrated level.
 * Ability comes ONLY from practice evidence. Searching for a hard word says nothing about ability.
 */
export function demonstratedLevel(state: LearnerState, catalogue: Record<string, Sense>): number {
  const ds = Object.values(state.senses)
    .filter(r => ['practising', 'secure'].includes(masteryLevel(r)) && catalogue[r.senseId])
    .map(r => catalogue[r.senseId].difficulty);
  return ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : 1;
}

export function recommend(state: LearnerState, catalogue: Record<string, Sense>, now: number, limit = 3): Recommendation[] {
  const out: Recommendation[] = [];
  const push = (r: Recommendation) => { if (!out.some(o => o.senseId === r.senseId)) out.push(r); };

  // Only words we have practice for can be recommended. Dictionary-only words (no practice yet) are simply skipped.
  for (const r of dueSenses(state, now)) {
    if (!catalogue[r.senseId]) continue;
    const overdue = Math.max(0, (now - r.due) / DAY);
    push({ senseId: r.senseId, kind: 'review', at: now, reason: { code: 'due', text: `Time to revisit "${catalogue[r.senseId]?.lemma ?? r.senseId}" in a new situation.`, factors: { overdueDays: +overdue.toFixed(1), stage: r.stage } } });
  }
  for (const r of Object.values(state.senses)) {
    if (!catalogue[r.senseId]) continue;
    if (r.lastAttemptAt === 0) push({ senseId: r.senseId, kind: 'learn', at: now, reason: { code: 'captured-unpractised', text: `You saved "${catalogue[r.senseId]?.lemma}". Let's practise it.`, factors: { capturedAt: r.capturedAt } } });
  }

  const level = demonstratedLevel(state, catalogue);
  const target = Math.min(5, Math.ceil(level) + (Object.keys(state.senses).length ? 1 : 0));
  const recent = Object.values(state.senses).filter(r => now - Math.max(r.lastAttemptAt, r.capturedAt) < 7 * DAY);
  const relatedToRecent = new Set(recent.flatMap(r => catalogue[r.senseId]?.related ?? []));
  const isWeak = (id: string) => { const r = state.senses[id]; return !r || !['practising', 'secure'].includes(masteryLevel(r)); };
  const capturedLemmas = new Set(Object.keys(state.senses).map(id => catalogue[id]?.lemma));

  const cands = Object.values(catalogue)
    .filter(s => !state.senses[s.senseId] && !capturedLemmas.has(s.lemma))   // same-lemma sibling senses are chosen by the learner, not pushed
    .map(s => {
      const relevance = relatedToRecent.has(s.senseId) ? 3 : 0;
      const gap = Math.abs(s.difficulty - target);
      return { s, relevance, gap, score: relevance * 2 - gap };
    })
    .sort((a, b) => b.score - a.score || a.s.difficulty - b.s.difficulty || a.s.senseId.localeCompare(b.s.senseId));

  for (const c of cands) {
    if (out.length >= limit) break;
    const missing = c.s.prerequisites.filter(p => catalogue[p] && isWeak(p));
    if (missing.length) {   // prerequisite recovery: teach the easier idea first, and say why
      const p = catalogue[missing.sort((a, b) => catalogue[a].difficulty - catalogue[b].difficulty)[0]];
      push({ senseId: p.senseId, kind: 'prerequisite', at: now, reason: { code: 'prereq-missing', text: `"${p.lemma}" helps you understand "${c.s.lemma}", so start there.`, factors: { forWord: c.s.lemma, difficulty: p.difficulty } } });
    } else {
      push({ senseId: c.s.senseId, kind: 'learn', at: now, reason: {
        code: c.relevance ? 'related-to-recent' : 'next-challenge',
        text: c.relevance ? `Related to words you just worked on, at a manageable challenge.` : `A good next step for your level.`,
        factors: { difficulty: c.s.difficulty, targetDifficulty: target, demonstratedLevel: +level.toFixed(2), relatedBonus: c.relevance } } });
    }
  }
  return out.slice(0, limit);
}

export function recordRecommendations(state: LearnerState, recs: Recommendation[]): LearnerState {
  return { ...state, recommendations: [...state.recommendations, ...recs].slice(-50) };
}
