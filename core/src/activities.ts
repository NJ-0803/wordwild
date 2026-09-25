import type { ChoiceItem, ErrorType, ExplainItem, LearnerState, PracticeItem, Sense, Skill } from './types.ts';

export function rng(seed: string) {          // mulberry32 over an FNV hash: deterministic per seed
  let h = 2166136261;
  for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export interface ActivityInstance { senseId: string; item: PracticeItem; optionOrder: string[] | null; seed: string }

/**
 * Picks the next practice item for a sense. Prefers (1) skills with least independent evidence,
 * (2) an item different from the last one, so a later recall meets the word in a new context.
 * Shuffles options deterministically and never puts the correct answer where it was last time.
 */
export function nextActivity(state: LearnerState, sense: Sense, seed: string, prevCorrectPos: number | null = null): ActivityInstance {
  const rec = state.senses[sense.senseId];
  const usedRecently = rec?.lastActivityId;
  const evidenceOf = (k: Skill) => rec?.evidence[k]?.independentCorrect ?? 0;
  const done = new Set(Object.values(state.attempts).filter(a => a.senseId === sense.senseId).map(a => a.activityId));
  const scored = sense.practice.map(i => ({
    i, score: evidenceOf(i.skill) * 10 + (done.has(i.id) ? 5 : 0) + (i.id === usedRecently ? 100 : 0)
      + (i.kind === 'explain-back' && (rec?.stage ?? 0) < 1 ? 20 : 0),   // free answers after a first success, not first
  })).sort((a, b) => a.score - b.score || a.i.id.localeCompare(b.i.id));
  const item = scored[0].i;
  if (item.kind === 'explain-back') return { senseId: sense.senseId, item, optionOrder: null, seed };
  const r = rng(seed + item.id);
  const ids = item.options.map(o => o.id);
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  if (prevCorrectPos !== null && ids.indexOf(item.correctId) === prevCorrectPos) {
    const swap = (prevCorrectPos + 1) % ids.length;
    [ids[prevCorrectPos], ids[swap]] = [ids[swap], ids[prevCorrectPos]];
  }
  return { senseId: sense.senseId, item, optionOrder: ids, seed };
}

export interface ChoiceFeedback { correct: boolean; errorType: ErrorType | null; message: string; explanation: string }
/** Wrong answers get a specific "why not" and the explanation. Wording never blames the learner. */
export function gradeChoice(item: ChoiceItem, optionId: string): ChoiceFeedback {
  const opt = item.options.find(o => o.id === optionId);
  if (!opt) throw new Error('unknown option');
  if (optionId === item.correctId) return { correct: true, errorType: null, message: 'That works.', explanation: item.explanation };
  const errorType: ErrorType = opt.errorType ?? (item.kind === 'conversation-choice' ? 'register' : 'meaning');
  return { correct: false, errorType, message: `Not quite. ${opt.why ?? ''}`.trim(), explanation: item.explanation };
}

export interface ExplainFeedback { level: 'covered' | 'partial' | 'unsure'; correct: boolean | null; covered: string[]; missing: string[]; message: string; modelAnswer: string }
/**
 * Keyword coverage is a weak signal, so this never returns "wrong". Only full coverage counts as evidence;
 * anything else is 'uncertain' (correct=null): shown the model answer, recorded, and changes no schedule.
 */
export function gradeExplain(item: ExplainItem, text: string): ExplainFeedback {
  const t = ` ${text.toLowerCase()} `;
  const covered = item.concepts.filter(c => c.terms.some(w => t.includes(w.toLowerCase()))).map(c => c.name);
  const missing = item.concepts.filter(c => !covered.includes(c.name)).map(c => c.name);
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words < 3) return { level: 'unsure', correct: null, covered, missing, message: 'Say a little more, or listen to the example answer.', modelAnswer: item.modelAnswer };
  if (missing.length === 0) return { level: 'covered', correct: true, covered, missing, message: 'That covers the main ideas.', modelAnswer: item.modelAnswer };
  return { level: 'partial', correct: null, covered, missing, message: 'We cannot fully check free answers. Yours may be fine in other words. Compare it with the example answer.', modelAnswer: item.modelAnswer };
}
