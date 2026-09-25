import type { Solver } from './enrich.ts';

/**
 * "Go deeper": what a dictionary definition does not tell you. Tone, an intensity ladder (mild -> strong), and sentences where
 * THIS word fits and a close synonym does not. AI drafts it; nothing is shown unless a blind solver confirms each claim.
 */
export const DEPTH_PROMPT_VERSION = 2;
export type Tone = 'positive' | 'neutral' | 'negative' | 'mixed';

export interface DepthDraft {
  feel: { tone: Tone; note: string };
  ladder: string[];                                            // 4-5 single words, mildest -> strongest, includes the target
  onlyThisWord: { sentence: string; other: string; whyNot: string }[];   // sentence has one blank "____"
}
export interface Depth { feel: DepthDraft['feel']; ladder: string[]; onlyThisWord: DepthDraft['onlyThisWord']; generatedBy: string; dropped: string[] }

const BLANK = '____';
const clean = (t: string) => typeof t === 'string' && t.trim().length > 0 && !/[<>]|https?:|www\./i.test(t);
const oneWord = (w: string) => /^[a-z]{2,24}$/.test(w);

export function checkDepthDraft(target: string, d: DepthDraft): string[] {
  const p: string[] = []; const need = (c: unknown, m: string) => { if (!c) p.push(m); };
  need(['positive', 'neutral', 'negative', 'mixed'].includes(d.feel?.tone) && clean(d.feel?.note) && d.feel.note.length <= 200, 'feel: tone and a short note are required');
  need(Array.isArray(d.ladder) && d.ladder.length >= 4 && d.ladder.length <= 5 && d.ladder.every(oneWord), 'ladder: 4-5 single lowercase words');
  need(d.ladder?.includes(target), 'ladder must include the target word');
  need(new Set(d.ladder).size === d.ladder?.length, 'ladder words must be unique');
  need(Array.isArray(d.onlyThisWord) && d.onlyThisWord.length >= 2 && d.onlyThisWord.length <= 3, 'need 2-3 "only this word" sentences');
  for (const [n, o] of (d.onlyThisWord ?? []).entries()) {
    need(clean(o.sentence) && o.sentence.split(BLANK).length === 2 && o.sentence.length <= 140, `only-this-word ${n + 1}: sentence needs exactly one blank`);
    need(oneWord(o.other) && o.other !== target, `only-this-word ${n + 1}: the other word must be a different single word`);
    need(clean(o.whyNot) && o.whyNot.length <= 180, `only-this-word ${n + 1}: needs a short reason`);
  }
  return p;
}

export type DepthOutcome =
  | { ok: true; depth: Depth }
  | { ok: false; stage: 'draft' | 'verify'; problems: string[]; transient: boolean };

/** Rotated (not authored) order so a position bias in the generator cannot leak through. */
const rotate = <T,>(a: T[], k = 1) => a.map((_, i) => a[(i + k) % a.length]);

export async function makeDepth(target: string, generate: () => Promise<DepthDraft>, solve: Solver, model: string, exists: (lemma: string) => Promise<boolean>): Promise<DepthOutcome> {
  let d: DepthDraft; let bad: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    try { d = await generate(); } catch (e) { return { ok: false, stage: 'draft', problems: [`generation failed: ${(e as Error).message}`], transient: true }; }
    bad = checkDepthDraft(target, d);
    if (!bad.length) break;
  }
  if (bad.length) return { ok: false, stage: 'draft', problems: bad, transient: false };
  d = d!;
  const dropped: string[] = [];
  const ask = async (prompt: string, options: string[]) => { try { return await solve({ prompt, options }); } catch { try { return await solve({ prompt, options }); } catch { return null; } } };

  // 1) "only this word fits": the solver must pick the target over the synonym, with no ambiguity
  const keep: DepthDraft['onlyThisWord'] = [];
  for (const o of d.onlyThisWord) {
    const opts = rotate([target, o.other]);
    const r = await ask(`Which word fits the blank best? "${o.sentence}"`, opts);
    if (!r) return { ok: false, stage: 'verify', problems: ['solver unavailable'], transient: true };
    if (opts[r.answer] === target && !r.alsoCorrect) keep.push(o); else dropped.push(`only-this-word: "${o.sentence.slice(0, 40)}"`);
  }
  if (keep.length < 1) return { ok: false, stage: 'verify', problems: ['no "only this word" sentence survived verification', ...dropped], transient: false };

  // 2) the ladder: the solver must find the strongest and the mildest word where the draft says they are
  let ladder = d.ladder;
  const shown = rotate(d.ladder, 2);
  const strongest = await ask(`Which of these words is the STRONGEST, most intense in meaning?`, shown);
  const mildest = await ask(`Which of these words is the MILDEST, least intense in meaning?`, shown);
  if (!strongest || !mildest) return { ok: false, stage: 'verify', problems: ['solver unavailable'], transient: true };
  const okLadder = shown[strongest.answer] === d.ladder[d.ladder.length - 1] && shown[mildest.answer] === d.ladder[0];
  if (!okLadder) { ladder = []; dropped.push('ladder'); }
  else {
    const real: string[] = []; for (const w of d.ladder) if (w === target || await exists(w)) real.push(w);      // every rung must be a real dictionary word
    ladder = real.length >= 3 && real.includes(target) ? real : [];
    if (!ladder.length) dropped.push('ladder: unknown words');
  }
  return { ok: true, depth: { feel: d.feel, ladder, onlyThisWord: keep, generatedBy: `${model}@depth-v${DEPTH_PROMPT_VERSION}`, dropped } };
}
