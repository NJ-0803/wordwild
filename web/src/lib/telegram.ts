import { randomBytes } from "node:crypto";
import { dailyMessage, localHour, sanitizeTelegramText, cleanInput } from "@core";
import { lookupDict, suggestLemmas } from "./db";
import { chooseForUser } from "./daily";
import { sql } from "./sql";

const API = (m: string) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${m}`;
export const telegramConfigured = () => !!process.env.TELEGRAM_BOT_TOKEN;
const appUrl = () => (process.env.APP_URL ?? "http://localhost:3100").replace(/\/+$/, "");

/** Bounded, never throws: a Telegram outage must not break anything else. */
export async function tgSend(chatId: number, text: string, button?: { text: string; url: string }): Promise<boolean> {
  try {
    const r = await fetch(API("sendMessage"), { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true,
        ...(button && button.url.startsWith("https://") ? { reply_markup: { inline_keyboard: [[{ text: button.text, url: button.url }]] } } : {}) }) });
    return r.ok;
  } catch { return false; }
}

// ---- linking ----
export async function makeLinkCode(userId: string): Promise<string> {
  const code = randomBytes(6).toString("base64url");
  await sql().query(`delete from ww_telegram_links where user_id = $1 or expires_at < now()`, [userId]);
  await sql().query(`insert into ww_telegram_links (code, user_id, expires_at) values ($1, $2, now() + interval '10 minutes')`, [code, userId]);
  return code;
}
/** One-time: consuming a code deletes it, so a leaked link cannot be reused. */
export async function consumeLinkCode(code: string, chatId: number): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{6,16}$/.test(code)) return false;
  const r = (await sql().query(`delete from ww_telegram_links where code = $1 and expires_at > now() returning user_id`, [code])) as unknown as { user_id: string }[];
  if (!r[0]) return false;
  await sql().query(`insert into ww_telegram (user_id, chat_id) values ($1, $2) on conflict (user_id) do update set chat_id = excluded.chat_id, last_sent_day = -1`, [r[0].user_id, chatId]);
  return true;
}
export async function unlinkChat(chatId: number) { await sql().query(`delete from ww_telegram where chat_id = $1`, [chatId]); }
export async function linkedFor(userId: string) {
  const r = (await sql().query(`select hour, tz, lang from ww_telegram where user_id = $1`, [userId])) as unknown as { hour: number; tz: number; lang: string }[];
  return r[0] ?? null;
}
export async function saveSchedule(userId: string, hour: number, tz: number, lang: string) {
  await sql().query(`update ww_telegram set hour = $2, tz = $3, lang = $4 where user_id = $1`, [userId, Math.min(23, Math.max(0, hour | 0)), Math.max(-720, Math.min(840, tz | 0)), lang === "en" ? "en" : "hi"]);
}

// ---- the word of the day ----
/** Called hourly. Sends at most one message per learner per local day, at the hour they chose. Returns counts for the log. */
export async function runDaily(now = Date.now()) {
  const rows = (await sql().query(`select user_id, chat_id, hour, tz, lang, last_sent_day from ww_telegram`)) as unknown as { user_id: string; chat_id: string; hour: number; tz: number; lang: string; last_sent_day: number }[];
  let sent = 0, skipped = 0, quiet = 0, failed = 0;
  for (const r of rows) {
    const day = Math.floor((now + r.tz * 60_000) / 86_400_000);
    if (localHour(now, r.tz) !== r.hour || r.last_sent_day === day) { skipped++; continue; }
    try {
      const pick = await chooseForUser(r.user_id, now, r.tz);
      await sql().query(`update ww_telegram set last_sent_day = $2 where user_id = $1`, [r.user_id, day]);      // mark first: a crash must never cause a double send
      if (!pick) { quiet++; continue; }
      const ok = await tgSend(Number(r.chat_id), dailyMessage(pick.kind, pick.w, r.lang === "en" ? "en" : "hi", pick.from), { text: "Open in Wordwild", url: `${appUrl()}/learn/${encodeURIComponent(pick.senseId)}` });
      if (ok) sent++; else failed++;
    } catch (e) { failed++; console.error("daily failed", (e as Error).message); }
  }
  return { learners: rows.length, sent, skipped, quiet, failed };
}

// ---- the bot as a dictionary ----
const buckets = new Map<number, number[]>();
const limited = (chat: number) => { const t = Date.now(), a = (buckets.get(chat) ?? []).filter(x => t - x < 60_000); a.push(t); buckets.set(chat, a); return a.length > 12; };

export async function handleUpdate(update: { message?: { chat?: { id?: number }; text?: string } }) {
  const chat = update.message?.chat?.id; const text = sanitizeTelegramText(update.message?.text);
  if (typeof chat !== "number" || !text) return;
  if (limited(chat)) return;
  if (text.startsWith("/start")) {
    const code = text.split(/\s+/)[1];
    if (code && (await consumeLinkCode(code, chat))) await tgSend(chat, "✅ <b>Linked to Wordwild.</b>\nYou will get one word a day. Nothing to keep up with: skipped days cost nothing.\n\nYou can also send me any English word and I will tell you what it means. Send /stop to turn this off.");
    else await tgSend(chat, "Hello! Send me any English word and I will tell you what it means, in simple words.\nTo get a daily word, link me from Settings in Wordwild.");
    return;
  }
  if (text === "/stop") { await unlinkChat(chat); await tgSend(chat, "Stopped. You can still send me a word any time."); return; }
  if (text === "/help") { await tgSend(chat, "Send one English word, like <b>skeptical</b>, and I will explain it. /stop turns off the daily word."); return; }
  const cleaned = cleanInput(text);
  if (!cleaned.query) { await tgSend(chat, (cleaned.message ?? "Please send one English word.").replace(/[<>&]/g, "")); return; }
  const q = cleaned.query;
  const hit = await lookupDict(q);
  if (!hit) { const sug = await suggestLemmas(q); await tgSend(chat, `I do not have “${q.replace(/[<>&]/g, "")}” yet. I will not guess.${sug.length ? ` Did you mean: ${sug.join(", ")}?` : ""}`); return; }
  const s = hit.senses[0];
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const more = hit.senses.length > 1 ? `\n\n<i>${hit.senses.length} meanings. Open Wordwild to choose.</i>` : "";
  await tgSend(chat, `${hit.note ? `<i>${esc(hit.note)}</i>\n\n` : ""}<b>${esc(s.lemma)}</b> <i>${esc(s.pos)}</i>\n\n${esc(s.simple)}${s.explanations.hi ? `\n\n${esc(s.explanations.hi)}` : ""}${s.examples[0] ? `\n\n“${esc(s.examples[0].text)}”` : ""}${more}`, { text: "Save in Wordwild", url: `${appUrl()}/capture?word=${encodeURIComponent(hit.matched)}` });
}
