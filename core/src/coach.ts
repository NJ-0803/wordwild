import type { Solver } from './enrich.ts';

/**
 * The Word Coach: a dictionary says what a word means; a coach says how to USE it. One example per situation (job interview, college
 * essay, everyday talk, story), a memory hook, words it is easily mixed up with, and cases to avoid.
 *
 * AI drafts it. Nothing is shown unless it passes deterministic checks AND a second, blind model confirms it:
 *  - every example sentence must let a blind solver pick this word's real meaning over the meanings of its look-alike words,
 *  - every look-alike word must exist in the dictionary (no invented words), and its definition is the dictionary's, not the AI's,
 *  - every "avoid" statement must be judged true by the blind solver,
 *  - memory hooks may not claim word history (etymology): those are the easiest things for a model to invent.
 * Everything that survives is still labelled as AI-drafted and not reviewed by a person.
 */
export const COACH_PROMPT_VERSION = 1;
export const INTENTS = ['interview', 'essay', 'casual', 'story'] as const;
export type Intent = (typeof INTENTS)[number];
export const INTENT_LABEL: Record<Intent, { en: string; hi: string }> = {
  interview: { en: 'Job interview', hi: 'नौकरी का इंटरव्यू' },
  essay: { en: 'College essay', hi: 'कॉलेज निबंध' },
  casual: { en: 'Everyday talk', hi: 'रोज़ की बातचीत' },
  story: { en: 'Story or writing', hi: 'कहानी या लेखन' },
};

export interface CoachDraft {
  examples: { intent: Intent; sentence: string }[];
  memoryHook: string;
  confusables: { word: string; difference: string }[];
  notFor: string[];
}
export interface Coach {
  examples: { intent: Intent; sentence: string }[];
  memoryHook: string | null;
  confusables: { word: string; difference: string; definition: string }[];
  notFor: string[];
  generatedBy: string;
  dropped: string[];
}

const clean = (t: unknown): t is string => typeof t === 'string' && t.trim().length > 0 && !/[<>]|https?:|www\.|\d/i.test(t);
const words = (t: string) => t.toLowerCase().match(/[\p{L}']+/gu) ?? [];
const oneWord = (w: unknown): w is string => typeof w === 'string' && /^[a-z]{2,24}$/.test(w);
const ETYMOLOGY = /\b(comes? from|derived|derives|origin(ates)?|etymolog|latin|greek|old english|french|root word|word history|named after)\b/i;

/** A loose "is this word or a normal form of it in the sentence" test. Not a stemmer: it only decides whether a sentence is about the target word. */
export function containsForm(sentence: string, target: string): boolean {
  const head = target.split(' ')[0].toLowerCase();
  const stem = head.length > 3 && /[ey]$/.test(head) ? head.slice(0, -1) : head;
  return new RegExp(`\\b${stem.replace(/[^a-z]/g, '')}[a-z]{0,4}\\b`, 'i').test(sentence);
}
const jaccard = (a: string, b: string) => { const x = new Set(words(a)), y = new Set(words(b)); const i = [...x].filter(w => y.has(w)).length; return i / (x.size + y.size - i || 1); };

export function checkCoachDraft(target: string, definition: string, d: CoachDraft): string[] {
  const p: string[] = []; const need = (c: unknown, m: string) => { if (!c) p.push(m); };
  const ex = Array.isArray(d.examples) ? d.examples : [];
  need(ex.length === 4 && INTENTS.every(i => ex.filter(e => e.intent === i).length === 1), 'need exactly one example for each of: interview, essay, casual, story');
  for (const e of ex) {
    const n = clean(e.sentence) ? words(e.sentence).length : 0;
    need(clean(e.sentence) && n >= 6 && n <= 26, `${e.intent}: the example must be a clean sentence of 6-26 words`);
    need(clean(e.sentence) && /[.!?]$/.test(e.sentence.trim()), `${e.intent}: the example must end like a sentence`);
    need(clean(e.sentence) && containsForm(e.sentence, target), `${e.intent}: the example must use the word "${target}"`);
    need(!clean(e.sentence) || !e.sentence.toLowerCase().includes(definition.toLowerCase().slice(0, 40)), `${e.intent}: the example must not just repeat the definition`);
  }
  // natural, not repetitive: different openings and low overlap between any two examples
  const opening = ex.filter(e => clean(e.sentence)).map(e => words(e.sentence).slice(0, 3).join(' '));
  need(new Set(opening).size === opening.length, 'examples must not start the same way');
  for (let i = 0; i < ex.length; i++) for (let j = i + 1; j < ex.length; j++) need(!clean(ex[i].sentence) || !clean(ex[j].sentence) || jaccard(ex[i].sentence, ex[j].sentence) < 0.55, `${ex[i].intent} and ${ex[j].intent} examples are too alike`);
  need(clean(d.memoryHook) && d.memoryHook.length >= 20 && d.memoryHook.length <= 180, 'memoryHook: a short hook of 20-180 characters is required');
  need(!clean(d.memoryHook) || !ETYMOLOGY.test(d.memoryHook), 'memoryHook must not make claims about word history');
  const c = Array.isArray(d.confusables) ? d.confusables : [];
  need(c.length <= 3, 'confusables: at most 3 look-alike words (none is fine when nothing is truly confusable)');
  for (const [n, x] of c.entries()) { need(oneWord(x.word) && x.word !== target, `confusable ${n + 1}: one different lowercase word`); need(clean(x.difference) && x.difference.length >= 15 && x.difference.length <= 160, `confusable ${n + 1}: a short difference is required`); }
  need(new Set(c.map(x => x.word)).size === c.length, 'confusables must be unique');
  const nf = Array.isArray(d.notFor) ? d.notFor : [];
  need(nf.length <= 2 && nf.every(s => clean(s) && s.length >= 15 && s.length <= 140), 'notFor: at most 2 short statements');
  return p;
}

export type CoachOutcome =
  | { ok: true; coach: Coach }
  | { ok: false; stage: 'draft' | 'verify'; problems: string[]; transient: boolean };

const rotate = <T,>(a: T[], k = 1) => a.map((_, i) => a[(i + k) % a.length]);

/**
 * `defOf` returns the dictionary's own definition of a word or null if it is not a word we know.
 * That is the single source for every look-alike word: the AI proposes the word, the dictionary supplies its meaning.
 */
async function makeCoachOnce(
  target: string, ctx: { definition: string; pos?: string; /** true when the word has more than one part of speech, so the part of speech is worth checking */ checkPos?: boolean; /** definitions of OTHER meanings of the same word, used as decoys */ decoys?: string[] }, generate: (problems?: string[]) => Promise<CoachDraft>, solve: Solver, model: string, defOf: (lemma: string) => Promise<string | null>, hint?: string[],
): Promise<CoachOutcome> {
  let d!: CoachDraft; let bad: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    // The second try is told exactly what was wrong with the first draft (a repair loop).
    try { d = await generate(attempt === 0 ? hint : bad); } catch (e) { return { ok: false, stage: 'draft', problems: [`generation failed: ${(e as Error).message}`], transient: true }; }
    bad = checkCoachDraft(target, ctx.definition, d);
    if (!bad.length) break;
  }
  if (bad.length) return { ok: false, stage: 'draft', problems: bad, transient: false };
  const dropped: string[] = [];
  const ask = async (prompt: string, options: string[]) => { try { return await solve({ prompt, options }); } catch { try { return await solve({ prompt, options }); } catch { return null; } } };

  // Look-alike words must be real words; their meaning comes from the dictionary (looked up together, not one by one).
  const found = await Promise.all(d.confusables.map(async x => ({ x, def: await defOf(x.word).catch(() => null) })));
  const conf: Coach['confusables'] = [];
  for (const { x, def } of found) { if (def) conf.push({ word: x.word, difference: x.difference, definition: def }); else dropped.push(`confusable "${x.word}" is not in the dictionary`); }

  // All blind checks run at once: speed matters (target: a few seconds), and none depends on another.
  const POS = ['noun', 'verb', 'adjective', 'adverb'];
  const checkPos = !!ctx.checkPos && !!ctx.pos && POS.includes(ctx.pos) && !target.includes(' ');
  // decoys for the meaning check: look-alike words' dictionary meanings, other meanings of this word, and as a last resort an unrelated idea
  const decoyDefs = [...conf.map(c => c.definition), ...(ctx.decoys ?? [])].filter(x => x !== ctx.definition);
  if (!decoyDefs.length) decoyDefs.push('something completely unrelated to this word');
  const [exChecks, nfChecks] = await Promise.all([
    Promise.all(d.examples.map(async e => {
      const opts = rotate([ctx.definition, ...decoyDefs.slice(0, 2)]);
      const [meaning, pos] = await Promise.all([
        ask(`In this sentence, which meaning does the word "${target}" have? "${e.sentence}"`, opts),
        checkPos ? ask(`In this sentence, is the word "${target}" used as a noun, a verb, an adjective or an adverb? "${e.sentence}"`, rotate(POS, 2)) : Promise.resolve(null),
      ]);
      const posOk = !checkPos || (!!pos && rotate(POS, 2)[pos.answer] === ctx.pos);
      return { e, unavailable: !meaning || (checkPos && !pos), ok: !!meaning && opts[meaning.answer] === ctx.definition && posOk, why: !posOk ? 'used as a different part of speech' : 'the meaning was not confirmed' };
    })),
    Promise.all(d.notFor.map(async s => {
      const opts = rotate(['True', 'False']);
      const r = await ask(`The word "${target}" means: "${ctx.definition}". Is this statement true about using the word? "${s}"`, opts);
      return { s, r, ok: !!r && opts[r.answer] === 'True' && !r.alsoCorrect };
    })),
  ]);
  if (exChecks.some(c => c.unavailable)) return { ok: false, stage: 'verify', problems: ['solver unavailable'], transient: true };
  const examples = exChecks.filter(c => c.ok).map(c => c.e);
  for (const c of exChecks) if (!c.ok) dropped.push(`${c.e.intent}: ${c.why}`);
  if (examples.length < 2) return { ok: false, stage: 'verify', problems: ['fewer than two examples were confirmed'], transient: false };
  const notFor = nfChecks.filter(c => c.ok).map(c => c.s);
  for (const c of nfChecks) if (!c.ok) dropped.push(`avoid statement not confirmed: ${c.s.slice(0, 40)}`);

  return { ok: true, coach: { examples, memoryHook: d.memoryHook, confusables: conf, notFor, generatedBy: model, dropped } };
}

/**
 * Drafts vary from run to run and the verifier is strict on purpose. If a draft fails verification (not because of an outage),
 * one fresh draft is made, told what the checker rejected, before giving up. Two full tries at most, so cost stays bounded.
 */
export async function makeCoach(
  target: string, ctx: Parameters<typeof makeCoachOnce>[1], generate: (problems?: string[]) => Promise<CoachDraft>, solve: Solver, model: string, defOf: (lemma: string) => Promise<string | null>,
): Promise<CoachOutcome> {
  const first = await makeCoachOnce(target, ctx, generate, solve, model, defOf);
  if (first.ok || first.stage !== 'verify' || first.transient) return first;
  return makeCoachOnce(target, ctx, generate, solve, model, defOf, first.problems);
}
