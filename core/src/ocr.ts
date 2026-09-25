import { heuristicLevel } from './constellation.ts';

/** Helpers for reading a photographed page. Pure: the recognition itself happens in the browser, on the device. */
export const cleanOcrWord = (raw: string): string | null => {
  if (/[\d@#/\\_=+*<>|]/.test(String(raw ?? ''))) return null;               // 4th, a@b.com, #tag, file_name: not vocabulary
  const w = String(raw ?? '').normalize('NFKC').replace(/[’‘]/g, "'").replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '').toLowerCase();
  if (w.length < 2 || w.length > 30 || !/^[\p{L}][\p{L}'-]*$/u.test(w)) return null;
  return w;
};

/** Joins recognised lines into running text, mending words split across lines ("under-" + "stand"). */
export function joinLines(lines: string[]): string {
  let out = '';
  for (const raw of lines) {
    const l = raw.trim(); if (!l) continue;
    if (/[\p{L}]-$/u.test(out) && /^\p{Ll}/u.test(l)) out = out.slice(0, -1) + l; else out += (out ? ' ' : '') + l;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** The sentence the word was found in: saved privately as "where I saw it". */
export function sentenceAround(lines: string[], word: string): string {
  const text = joinLines(lines);
  const sentences = text.match(/[^.!?…]+[.!?…]*/g) ?? [text];
  const rx = new RegExp(`(^|[^\\p{L}])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'iu');
  const hit = sentences.find(s => rx.test(s)) ?? '';
  return hit.trim().slice(0, 300);
}

const COMMON = new Set('the a an and or but if of to in on at by for with from as is are was were be been it its this that these those i you he she we they my your his her our their not no do does did have has had will would can could may might so than then there here what which who whom when where why how all any some more most such into out up down over under about after before again also just very'.split(' '));

/** Which words on the page are probably unfamiliar? Estimates only: length and word shape, unless a better `levelOf` is supplied. */
export function unfamiliarWords(words: { clean: string; conf: number }[], learnerLevel: number, levelOf: (w: string) => number = w => heuristicLevel(w, 2, false), limit = 8): string[] {
  const seen = new Set<string>(); const scored: { w: string; l: number; i: number }[] = [];
  words.forEach((x, i) => {
    if (x.conf < 55 || COMMON.has(x.clean) || x.clean.length < 4 || seen.has(x.clean)) return;
    seen.add(x.clean); const l = levelOf(x.clean);
    if (l >= learnerLevel - 0.2) scored.push({ w: x.clean, l, i });
  });
  return scored.sort((a, b) => b.l - a.l || a.i - b.i).slice(0, limit).map(s => s.w);
}
