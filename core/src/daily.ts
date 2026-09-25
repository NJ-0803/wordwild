import type { LearnerState } from './types.ts';
import { townView } from './town.ts';

/**
 * What to say to a learner today. Never nagging: if there is nothing useful, say nothing.
 *  1. A word that is ripe for review (oldest first): "your word is ready".
 *  2. A word they saved but have not practised yet.
 *  3. A new word from the constellation of their most recent word.
 */
export type DailyKind = 'review' | 'first' | 'new' | 'none';
export interface DailyPick { kind: DailyKind; senseId?: string; from?: string }

export function pickDaily(state: LearnerState, now: number, tz: number, freshCandidates: { senseId: string; lemma: string; from: string }[] = []): DailyPick {
  const plots = townView(state, now, tz).plots;
  const review = plots.filter(p => p.ripe && !p.firstTime).sort((a, b) => a.dueAt - b.dueAt)[0];
  if (review) return { kind: 'review', senseId: review.senseId };
  const first = plots.filter(p => p.firstTime).sort((a, b) => (state.senses[a.senseId]?.capturedAt ?? 0) - (state.senses[b.senseId]?.capturedAt ?? 0))[0];
  if (first) return { kind: 'first', senseId: first.senseId };
  const known = new Set(Object.keys(state.senses));
  const fresh = freshCandidates.find(c => !known.has(c.senseId));
  if (fresh) return { kind: 'new', senseId: fresh.senseId, from: fresh.from };
  return { kind: 'none' };
}

/** Local hour for a timezone offset in minutes. */
export const localHour = (now: number, tzMinutes: number) => new Date(now + tzMinutes * 60_000).getUTCHours();

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export interface DailyText { lemma: string; pos: string; simple: string; hindi?: string; example?: string }

/** Telegram HTML message. Short, escaped, no promises about progress that we cannot keep. */
export function dailyMessage(kind: DailyKind, w: DailyText, lang: 'hi' | 'en', from?: string): string {
  const head = kind === 'review' ? `🌾 <b>${esc(w.lemma)}</b> is ready to harvest`
    : kind === 'first' ? `🌱 <b>${esc(w.lemma)}</b> is waiting for its first practice`
    : `✨ A new word${from ? ` next to “${esc(from)}”` : ''}: <b>${esc(w.lemma)}</b>`;
  const lines = [head, `<i>${esc(w.pos)}</i>`, '', esc(w.simple)];
  if (lang === 'hi' && w.hindi) lines.push('', esc(w.hindi));
  if (w.example) lines.push('', `“${esc(w.example)}”`);
  return lines.join('\n').slice(0, 900);
}

export const sanitizeTelegramText = (t: unknown) => String(t ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 100);

// ---- WhatsApp ----
/** WhatsApp treats * _ ~ ` as formatting. Dictionary text must never accidentally bold or strike-through itself. */
export const waSafe = (t: string) => String(t ?? '').replace(/[*_~`]/g, '').replace(/\s+/g, ' ').trim();

/** WhatsApp text: *bold* and _italic_ only, short, no promises we cannot keep. */
export function dailyMessageWhatsApp(kind: DailyKind, w: DailyText, lang: 'hi' | 'en', from?: string): string {
  const head = kind === 'review' ? `🌾 *${waSafe(w.lemma)}* is ready to harvest`
    : kind === 'first' ? `🌱 *${waSafe(w.lemma)}* is waiting for its first practice`
    : `✨ A new word${from ? ` next to “${waSafe(from)}”` : ''}: *${waSafe(w.lemma)}*`;
  const lines = [head, `_${waSafe(w.pos)}_`, '', waSafe(w.simple)];
  if (lang === 'hi' && w.hindi) lines.push('', waSafe(w.hindi));
  if (w.example) lines.push('', `“${waSafe(w.example)}”`);
  lines.push('', 'Reply STOP to turn this off.');
  return lines.join('\n').slice(0, 1000);
}

/** WhatsApp allows 4096 characters per message; split on paragraph boundaries. */
export function chunkText(text: string, max = 3500): string[] {
  if (text.length <= max) return [text];
  const out: string[] = []; let cur = '';
  for (const para of text.split('\n\n')) {
    if ((cur + '\n\n' + para).length > max && cur) { out.push(cur); cur = para; } else cur = cur ? `${cur}\n\n${para}` : para;
    while (cur.length > max) { out.push(cur.slice(0, max)); cur = cur.slice(max); }
  }
  if (cur) out.push(cur); return out;
}

/** Commands people send to the bot. Case-insensitive; STOP is honoured in several common spellings, as WhatsApp requires. */
export type WaCommand = { kind: 'link'; code: string } | { kind: 'stop' } | { kind: 'help' } | { kind: 'start' } | { kind: 'word'; text: string } | { kind: 'ignore' };
export function parseWaCommand(raw: unknown): WaCommand {
  const t = sanitizeTelegramText(raw); if (!t) return { kind: 'ignore' };
  const lower = t.toLowerCase();
  if (/^(stop|unsubscribe|cancel|end|quit|opt.?out|रुको|बंद)$/.test(lower)) return { kind: 'stop' };
  const link = t.match(/^link\s+([A-Za-z0-9_-]{6,16})$/i); if (link) return { kind: 'link', code: link[1] };
  if (/^(help|\?|मदद)$/.test(lower)) return { kind: 'help' };
  if (/^(start|hi|hello|hey|नमस्ते)$/.test(lower)) return { kind: 'start' };
  return { kind: 'word', text: t };
}
