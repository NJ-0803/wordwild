import { relativeLabel } from './level.ts';

/**
 * Word Constellation: one lookup -> 5-6 related words, chosen for THIS learner and explained.
 * Candidates come from the dictionary graph (authoritative) and from AI suggestions constrained to real dictionary words.
 * Selection is a pure, deterministic function so it can be tested and its reasons shown.
 */
export type Role = 'same-meaning' | 'stronger' | 'gentler' | 'opposite' | 'used-together' | 'same-family' | 'same-situation' | 'easier-bridge';

export interface Candidate {
  lemma: string; senseId: string; pos: string; role: Role;
  level: number;              // predicted difficulty 1-5 (AI or heuristic)
  topics: string[];           // lowercase topic tags, e.g. "cooking", "emotion"
  simple: string;             // short meaning (WordNet definition)
  source: 'wordnet' | 'ai';
}
export interface Pick extends Candidate { why: string; score: number }

const ROLE_WEIGHT: Record<Role, number> = { 'same-meaning': 1.0, opposite: 0.95, stronger: 0.9, gentler: 0.9, 'used-together': 0.9, 'same-situation': 0.8, 'same-family': 0.75, 'easier-bridge': 0.6 };
export const ROLE_LABEL: Record<Role, string> = {
  'same-meaning': 'Nearly the same', stronger: 'Stronger', gentler: 'Gentler', opposite: 'The opposite', 'used-together': 'Often used together',
  'same-family': 'Same family', 'same-situation': 'Same situation', 'easier-bridge': 'Easier stepping stone',
};

export interface SelectInput {
  target: { lemma: string; level: number };
  learner: { level: number; interests: string[]; purpose?: string };
  candidates: Candidate[];
  known: Set<string>;         // lemmas already saved: never suggested again
  size?: number;
}

/** Edit distance, to spot spelling variants like skeptical/sceptical. */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

const bell = (x: number, mu: number, sigma = 0.9) => Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma));

export function whyText(role: Role, targetLemma: string, c: Candidate, learnerLevel: number): string {
  const rel = relativeLabel(c.level, learnerLevel);
  const t = `"${targetLemma}"`;
  const base: Record<Role, string> = {
    'same-meaning': `Means nearly the same as ${t}, so you can say it another way.`,
    stronger: `Like ${t}, but stronger.`, gentler: `Like ${t}, but softer.`,
    opposite: `The opposite of ${t}: knowing both makes each clearer.`,
    'used-together': `You will often meet it in the same sentences as ${t}.`,
    'same-family': `Belongs to the same family of ideas as ${t}.`,
    'same-situation': `Useful in the same kind of situation as ${t}.`,
    'easier-bridge': `A simpler word that helps you understand ${t}.`,
  };
  return `${base[role]} It is ${rel}.`;
}

export function selectConstellation(inp: SelectInput): Pick[] {
  const { target, learner, known } = inp;
  const size = inp.size ?? (learner.level < 2.5 ? 5 : 6);
  const wantHarder = Math.min(5, Math.max(1, learner.level + 0.6));                    // a stretch, not a leap
  const targetIsFar = target.level - learner.level >= 1;
  const interests = new Set(learner.interests.map(s => s.toLowerCase()));
  const purpose = learner.purpose?.toLowerCase();

  const best = new Map<string, Pick>();
  for (const c of inp.candidates) {
    if (c.lemma === target.lemma || known.has(c.lemma)) continue;
    if (c.role === 'same-meaning' && editDistance(c.lemma, target.lemma) <= 2) continue;     // a spelling variant (sceptical) teaches nothing new
    if (c.level > learner.level + 2.2) continue;                                     // far too hard right now
    const want = c.role === 'easier-bridge' ? Math.max(1, learner.level - 0.3) : wantHarder;
    let w = ROLE_WEIGHT[c.role];
    if (c.role === 'easier-bridge') w = targetIsFar ? 1.2 : 0.5;                      // bridges matter when the asked word is far above you
    const topicHit = c.topics.some(t => interests.has(t.toLowerCase())) ? 0.25 : 0;
    const purposeHit = purpose && c.topics.some(t => t.toLowerCase() === purpose) ? 0.15 : 0;
    const score = w * bell(c.level, want) + topicHit + purposeHit;
    const pick: Pick = { ...c, score, why: whyText(c.role, target.lemma, c, learner.level) };
    const have = best.get(c.lemma);
    if (!have || pick.score > have.score) best.set(c.lemma, pick);
  }
  const ranked = [...best.values()].sort((a, b) => b.score - a.score || a.lemma.localeCompare(b.lemma));

  const out: Pick[] = []; const perRole: Partial<Record<Role, number>> = {};
  const take = (p: Pick) => { out.push(p); perRole[p.role] = (perRole[p.role] ?? 0) + 1; };
  const opp = ranked.find(p => p.role === 'opposite' && p.score > 0.15);              // knowing the opposite makes a word clearer: always try to include one
  if (opp) take(opp);
  if (targetIsFar) { const bridge = ranked.find(p => p.role === 'easier-bridge' && !out.includes(p) && !out.some(o => o.simple === p.simple)); if (bridge) take(bridge); }
  const sameMeaningShown = (p: Pick) => out.some(o => o.simple === p.simple);          // two cards with the identical definition teach nothing new
  for (const p of ranked) {
    if (out.length >= size) break;
    if (out.includes(p) || sameMeaningShown(p)) continue;
    const cap = p.role === 'easier-bridge' ? 1 : 2;                                   // variety: at most 2 of one kind
    if ((perRole[p.role] ?? 0) >= cap) continue;
    take(p);
  }
  return out.sort((a, b) => a.level - b.level || a.lemma.localeCompare(b.lemma));      // shown easiest -> hardest
}

/** Cheap fallback when the AI level predictor is unavailable. Labelled 'heuristic' by callers; never presented as expert judgement. */
export function heuristicLevel(lemma: string, senseCount: number, hasPronunciation: boolean): number {
  const len = lemma.replace(/[^a-z]/gi, '').length;
  let l = 1.6 + Math.max(0, len - 5) * 0.28 + (senseCount <= 1 ? 0.6 : 0) + (hasPronunciation ? -0.2 : 0.4);
  if (/(tion|sion|ment|ness|ity|ous|ive|ize|ise)$/.test(lemma)) l += 0.5;
  return Math.min(5, Math.max(1, Math.round(l * 10) / 10));
}
