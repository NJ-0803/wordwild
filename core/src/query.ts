/**
 * Everything between "what the person typed" and "what we ask the dictionary". Pure, no I/O.
 * Rules: never guess silently (say what we matched), never reject something a person could reasonably type
 * (punctuation, quotes, capitals, invisible characters), and say plainly why something cannot be looked up.
 */
import { normalizeQuery, isValidQuery } from './dictionary.ts';

export type InputKind =
  | 'ok' | 'empty' | 'too-long' | 'sentence' | 'digits' | 'url' | 'non-latin' | 'acronym' | 'contraction' | 'symbols';

export interface Cleaned { query: string; kind: InputKind; note?: string; message?: string }

// Invisible and layout characters that survive copy-paste from PDFs, chats and web pages.
const INVISIBLE = /[\u0000-\u001F\u007F-\u009F­​-‏‪-‮⁠-⁤﻿]/g;
const EDGE = /^[^\p{L}]+|[^\p{L}]+$/gu;                       // quotes, brackets, dots, commas, emoji, digits at either edge
const CONTRACTIONS: Record<string, string> = {
  "don't": 'do not', "doesn't": 'does not', "didn't": 'did not', "can't": 'cannot', "won't": 'will not', "isn't": 'is not', "aren't": 'are not', "wasn't": 'was not',
  "weren't": 'were not', "haven't": 'have not', "hasn't": 'has not', "shouldn't": 'should not', "wouldn't": 'would not', "couldn't": 'could not', "i'm": 'I am',
  "it's": 'it is', "that's": 'that is', "let's": 'let us', "they're": 'they are', "we're": 'we are', "you're": 'you are', "i've": 'I have', "i'll": 'I will',
};

/**
 * Turns raw input into a lookup query plus, when it cannot be looked up, a kind and a friendly message.
 * Leading/trailing punctuation, curly quotes, possessives ("Nani's") and invisible characters are removed, not rejected.
 */
export function cleanInput(raw: unknown): Cleaned {
  const text = String(raw ?? '').normalize('NFKC').replace(INVISIBLE, '').replace(/[‘’ʼ]/g, "'").trim();
  if (!text) return { query: '', kind: 'empty', message: 'Type a word to look up.' };
  if (text.length > 120) return { query: '', kind: 'too-long', message: 'That is too long for one word. Type just the word you want to understand, or use Scan for a whole page.' };
  if (/^(https?:\/\/|www\.)/i.test(text) || /^\S+\.(com|org|net|in|io|co)(\/\S*)?$/i.test(text)) return { query: '', kind: 'url', message: 'That looks like a web address. Type the word you want to understand.' };
  const words = text.split(/\s+/);
  if (words.length > 3) return { query: '', kind: 'sentence', message: 'That is a whole sentence. Type one word from it, or use Scan or Voice to work with a full sentence.' };
  const lower = text.toLowerCase();
  if (CONTRACTIONS[lower]) return { query: '', kind: 'contraction', message: `“${text}” is short for “${CONTRACTIONS[lower]}”. Type one of those words to look it up.` };
  const letters = [...text].filter(c => /\p{L}/u.test(c));
  if (letters.length === 0 || /\d/.test(text)) return /\d/.test(text)
    ? { query: '', kind: 'digits', message: 'Numbers are not words, and words with numbers in them are not in a word list. Type the word you want to understand.' }
    : { query: '', kind: 'symbols', message: 'Please type letters to look up a word.' };
  // Devanagari, Arabic, CJK...: we look up English words only, and say so instead of failing quietly.
  if (letters.some(c => !/\p{Script=Latin}/u.test(c)))
    return { query: '', kind: 'non-latin', message: 'We can look up English words. For a Hindi word, try Ask by voice, or type the English word you are curious about.' };
  let q = words.map(w => w.replace(EDGE, '')).filter(Boolean).join(' ');
  q = q.replace(/'s$/i, '').replace(/'$/, '');                                       // Nani's -> Nani
  const acronym = words.length === 1 && /^[A-Z]{2,6}$/.test(words[0].replace(EDGE, ''));
  q = normalizeQuery(q);
  if (!isValidQuery(q)) return { query: '', kind: 'symbols', message: 'Please type letters only, for example: serendipity.' };
  return acronym ? { query: q, kind: 'acronym', note: 'This looks like an abbreviation. Abbreviations are often not in a word list.' } : { query: q, kind: 'ok' };
}

// ---------------------------------------------------------------------------------------------------------------------
// Irregular forms: went -> go, mice -> mouse. Endings cannot get these, so a table does. It is a proposal list only:
// the database decides which candidates exist.

const VERBS: [string, string][] = [
  ['be', 'am is are was were been being'], ['have', 'has had having'], ['do', 'does did done doing'], ['go', 'goes went gone going'], ['say', 'said'], ['make', 'made'],
  ['take', 'took taken'], ['come', 'came'], ['see', 'saw seen'], ['know', 'knew known'], ['get', 'got gotten'], ['give', 'gave given'], ['find', 'found'], ['think', 'thought'],
  ['tell', 'told'], ['become', 'became'], ['leave', 'left'], ['feel', 'felt'], ['bring', 'brought'], ['begin', 'began begun'], ['keep', 'kept'], ['hold', 'held'],
  ['write', 'wrote written'], ['stand', 'stood'], ['hear', 'heard'], ['mean', 'meant'], ['meet', 'met'], ['run', 'ran'], ['pay', 'paid'], ['sit', 'sat'], ['speak', 'spoke spoken'],
  ['lie', 'lay lain'], ['lay', 'laid'], ['lead', 'led'], ['grow', 'grew grown'], ['lose', 'lost'], ['fall', 'fell fallen'], ['send', 'sent'], ['build', 'built'],
  ['understand', 'understood'], ['draw', 'drew drawn'], ['break', 'broke broken'], ['spend', 'spent'], ['rise', 'rose risen'], ['drive', 'drove driven'], ['buy', 'bought'],
  ['wear', 'wore worn'], ['choose', 'chose chosen'], ['eat', 'ate eaten'], ['fly', 'flew flown'], ['forget', 'forgot forgotten'], ['sell', 'sold'], ['teach', 'taught'],
  ['catch', 'caught'], ['fight', 'fought'], ['throw', 'threw thrown'], ['sing', 'sang sung'], ['swim', 'swam swum'], ['drink', 'drank drunk'], ['win', 'won'],
  ['hide', 'hid hidden'], ['shake', 'shook shaken'], ['steal', 'stole stolen'], ['wake', 'woke woken'], ['bite', 'bit bitten'], ['ring', 'rang rung'], ['sleep', 'slept'],
  ['sweep', 'swept'], ['lend', 'lent'], ['bend', 'bent'], ['hang', 'hung'], ['dig', 'dug'], ['feed', 'fed'], ['deal', 'dealt'], ['shoot', 'shot'], ['strike', 'struck'],
  ['swear', 'swore sworn'], ['tear', 'tore torn'], ['wind', 'wound'], ['forgive', 'forgave forgiven'], ['seek', 'sought'], ['sink', 'sank sunk'], ['slide', 'slid'],
  ['spin', 'spun'], ['stick', 'stuck'], ['sting', 'stung'], ['swing', 'swung'], ['weep', 'wept'], ['light', 'lit'], ['burn', 'burnt'], ['learn', 'learnt'], ['blow', 'blew blown'],
  ['show', 'shown'], ['sow', 'sown'], ['shrink', 'shrank shrunk'], ['beat', 'beaten'], ['bind', 'bound'], ['creep', 'crept'], ['flee', 'fled'], ['fling', 'flung'], ['grind', 'ground'],
  ['kneel', 'knelt'], ['lean', 'leant'], ['leap', 'leapt'], ['mislead', 'misled'], ['overcome', 'overcame'], ['ride', 'rode ridden'], ['shine', 'shone'],
  ['slay', 'slew slain'], ['spit', 'spat'], ['undo', 'undid undone'], ['withdraw', 'withdrew withdrawn'], ['undertake', 'undertook undertaken'], ['freeze', 'froze frozen'],
];
const NOUNS: [string, string][] = [
  ['man', 'men'], ['woman', 'women'], ['child', 'children'], ['foot', 'feet'], ['tooth', 'teeth'], ['goose', 'geese'], ['mouse', 'mice'], ['person', 'people'], ['ox', 'oxen'],
  ['louse', 'lice'], ['die', 'dice'], ['criterion', 'criteria'], ['phenomenon', 'phenomena'], ['cactus', 'cacti'], ['focus', 'foci'], ['analysis', 'analyses'], ['thesis', 'theses'],
  ['crisis', 'crises'], ['basis', 'bases'], ['hypothesis', 'hypotheses'], ['bacterium', 'bacteria'], ['datum', 'data'], ['medium', 'media'], ['wolf', 'wolves'], ['knife', 'knives'],
  ['leaf', 'leaves'], ['life', 'lives'], ['wife', 'wives'], ['half', 'halves'], ['shelf', 'shelves'], ['thief', 'thieves'], ['loaf', 'loaves'], ['calf', 'calves'], ['self', 'selves'],
  ['elf', 'elves'], ['scarf', 'scarves'], ['hoof', 'hooves'], ['fungus', 'fungi'], ['nucleus', 'nuclei'], ['stimulus', 'stimuli'], ['alumnus', 'alumni'], ['index', 'indices'],
  ['appendix', 'appendices'], ['matrix', 'matrices'], ['vertex', 'vertices'], ['axis', 'axes'], ['diagnosis', 'diagnoses'], ['parenthesis', 'parentheses'], ['curriculum', 'curricula'],
];
const ADJ: [string, string][] = [
  ['good', 'better best'], ['well', 'better best'], ['bad', 'worse worst'], ['far', 'farther further farthest furthest'], ['little', 'less least'], ['many', 'more most'],
  ['much', 'more most'], ['old', 'elder eldest'],
];
const IRREGULAR = new Map<string, string[]>();
for (const table of [VERBS, NOUNS, ADJ]) for (const [base, forms] of table) for (const f of forms.split(' ')) { const cur = IRREGULAR.get(f) ?? []; if (!cur.includes(base)) cur.push(base); IRREGULAR.set(f, cur); }
const IRREGULAR_POS = new Map<string, Pos[]>();
for (const [table, pos] of [[VERBS, ['v']], [NOUNS, ['n']], [ADJ, ['adj', 'adv']]] as [[string, string][], Pos[]][]) for (const [base, forms] of table) for (const f of forms.split(' ')) IRREGULAR_POS.set(`${f}>${base}`, pos);
export const irregularBases = (w: string): string[] => IRREGULAR.get(w) ?? [];

export type Pos = 'n' | 'v' | 'adj' | 'adv';
export interface LookupCandidate { lemma: string; kind: 'exact' | 'irregular' | 'rule'; posHint?: Pos[]; note?: string }

const CVC = /[^aeiou][aeiou][^aeiouwxy]$/;

/** Rule-based proposals for a single word. Order matters: earlier is more likely. */
function rules(w: string): { lemma: string; posHint: Pos[] }[] {
  const out: { lemma: string; posHint: Pos[] }[] = [];
  const add = (lemma: string, posHint: Pos[]) => { if (lemma.length >= 2 && lemma !== w && !out.some(o => o.lemma === lemma)) out.push({ lemma, posHint }); };
  if (w.endsWith('ies')) add(w.slice(0, -3) + 'y', ['n', 'v']);
  if (w.endsWith('ied')) add(w.slice(0, -3) + 'y', ['v']);
  if (w.endsWith('ier')) add(w.slice(0, -3) + 'y', ['adj']);
  if (w.endsWith('iest')) add(w.slice(0, -4) + 'y', ['adj']);
  if (w.endsWith('ves')) { add(w.slice(0, -3) + 'f', ['n']); add(w.slice(0, -3) + 'fe', ['n']); }
  if (/(s|x|z|ch|sh)es$/.test(w)) add(w.slice(0, -2), ['n', 'v']);
  if (w.endsWith('es')) add(w.slice(0, -2), ['n', 'v']);
  if (w.endsWith('s') && !w.endsWith('ss')) add(w.slice(0, -1), ['n', 'v']);
  if (w.endsWith('ed')) {
    const b = w.slice(0, -2); const dbl = /(.)\1$/.test(b);
    if (dbl) add(b.slice(0, -1), ['v']);
    if (CVC.test(b) && b.length <= 3) { add(b + 'e', ['v']); add(b, ['v']); } else { add(b, ['v']); add(b + 'e', ['v']); }
    add(w.slice(0, -1), ['v']);
  }
  if (w.endsWith('ing')) {
    const b = w.slice(0, -3); const dbl = /(.)\1$/.test(b);
    if (dbl) add(b.slice(0, -1), ['v']);                                              // hopping -> hop
    if (CVC.test(b) && b.length <= 3) { add(b + 'e', ['v']); add(b, ['v']); }         // hoping -> hope (single consonant: the e was dropped)
    else { add(b, ['v']); add(b + 'e', ['v']); }                                       // opening -> open, making -> make
  }
  if (w.endsWith('ily')) add(w.slice(0, -3) + 'y', ['adv']);
  if (w.endsWith('ly')) add(w.slice(0, -2), ['adv']);
  if (w.endsWith('er')) { add(w.slice(0, -2), ['adj', 'n']); add(w.slice(0, -1), ['adj']); const b = w.slice(0, -2); if (/(.)\1$/.test(b)) add(b.slice(0, -1), ['adj']); }
  if (w.endsWith('est')) { add(w.slice(0, -3), ['adj']); add(w.slice(0, -2), ['adj']); const b = w.slice(0, -3); if (/(.)\1$/.test(b)) add(b.slice(0, -1), ['adj']); }
  return out;
}

/**
 * Ordered dictionary candidates for a cleaned query: the word as typed first, irregular bases next, then rule-based guesses.
 * Phrases ("gave up", "ice creams") are handled by changing the first or last word.
 */
export function lookupCandidates(q: string): LookupCandidate[] {
  const out: LookupCandidate[] = [{ lemma: q, kind: 'exact' }];
  const seen = new Set([q]);
  const push = (c: LookupCandidate) => { if (!seen.has(c.lemma) && out.length < 14) { seen.add(c.lemma); out.push(c); } };
  const parts = q.split(' ');
  const variants = (w: string): LookupCandidate[] => [
    ...irregularBases(w).map(b => ({ lemma: b, kind: 'irregular' as const, posHint: IRREGULAR_POS.get(`${w}>${b}`) })),
    ...rules(w).map(r => ({ lemma: r.lemma, kind: 'rule' as const, posHint: r.posHint })),
  ];
  const rebuild = (i: number, w: string) => parts.map((p, j) => (j === i ? w : p)).join(' ');
  const slots = parts.length === 1 ? [0] : [0, parts.length - 1];
  for (const i of slots) for (const v of variants(parts[i])) push({ ...v, lemma: rebuild(i, v.lemma) });
  for (const c of out) if (c.kind !== 'exact') c.note = `“${q}” is a form of “${c.lemma}”.`;
  return out;
}
