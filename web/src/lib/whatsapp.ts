import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { chunkText, dailyMessageWhatsApp, isValidQuery, localHour, normalizeQuery, parseWaCommand, waSafe } from "@core";
import { lookupDict } from "./db";
import { chooseForUser } from "./daily";
import { sql } from "./sql";

const env = (k: string) => process.env[k] ?? "";
export const whatsappConfigured = () => !!(env("WHATSAPP_ACCESS_TOKEN") && env("WHATSAPP_PHONE_NUMBER_ID"));
const graph = () => `https://graph.facebook.com/${env("WHATSAPP_API_VERSION") || "v21.0"}/${env("WHATSAPP_PHONE_NUMBER_ID")}/messages`;
const appUrl = () => (env("APP_URL") || "http://localhost:3100").replace(/\/+$/, "");
const eq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// ---------- security ----------
/** Meta signs every webhook body with the app secret: `X-Hub-Signature-256: sha256=<hex>`. Compared in constant time on the RAW body. */
export function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!secret || !header || !header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return eq(header.slice(7), expected);
}
/** GET handshake when the webhook is registered. Returns the challenge to echo, or null. */
export function verifyHandshake(q: URLSearchParams, verifyToken: string): string | null {
  if (!verifyToken || q.get("hub.mode") !== "subscribe") return null;
  return eq(q.get("hub.verify_token") ?? "", verifyToken) ? (q.get("hub.challenge") ?? "") : null;
}
/** Meta retries deliveries; each message id is processed once. Returns true only the first time. */
export async function firstTimeSeen(id: string): Promise<boolean> {
  const r = (await sql().query(`insert into ww_wa_seen (id) values ($1) on conflict do nothing returning id`, [id.slice(0, 200)])) as unknown as unknown[];
  return r.length > 0;
}

// ---------- sending ----------
async function post(body: object): Promise<boolean> {
  try {
    const r = await fetch(graph(), { method: "POST", signal: AbortSignal.timeout(10_000), headers: { "content-type": "application/json", authorization: `Bearer ${env("WHATSAPP_ACCESS_TOKEN")}` }, body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...body }) });
    return r.ok;
  } catch { return false; }
}
/** Free-form text: only allowed inside the 24-hour window the learner opens by messaging us. */
export async function waText(to: string, text: string): Promise<boolean> {
  let ok = true; for (const part of chunkText(text)) ok = (await post({ to, type: "text", text: { body: part, preview_url: false } })) && ok; return ok;
}
/** Pre-approved template: the only way to message someone outside the window. */
export const waTemplate = (to: string, name: string, lang: string, params: string[]) =>
  post({ to, type: "template", template: { name, language: { code: lang }, ...(params.length ? { components: [{ type: "body", parameters: params.map(p => ({ type: "text", text: waSafe(p).slice(0, 200) })) }] } : {}) } });

// ---------- linking (opt-in by messaging us) ----------
export async function makeWaLink(userId: string): Promise<string> {
  const code = randomBytes(6).toString("base64url");
  await sql().query(`delete from ww_whatsapp_links where user_id = $1 or expires_at < now()`, [userId]);
  await sql().query(`insert into ww_whatsapp_links (code, user_id, expires_at) values ($1, $2, now() + interval '10 minutes')`, [code, userId]);
  return code;
}
/** One-time. The learner has sent us a message, which is their opt-in; we record when. */
export async function consumeWaLink(code: string, waId: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{6,16}$/.test(code) || !/^\d{7,15}$/.test(waId)) return false;
  const r = (await sql().query(`delete from ww_whatsapp_links where code = $1 and expires_at > now() returning user_id`, [code])) as unknown as { user_id: string }[];
  if (!r[0]) return false;
  await sql().query(`insert into ww_whatsapp (user_id, wa_id, window_until, consent_at) values ($1, $2, now() + interval '24 hours', now())
    on conflict (user_id) do update set wa_id = excluded.wa_id, window_until = excluded.window_until, consent_at = now(), last_sent_day = -1`, [r[0].user_id, waId]);
  return true;
}
export async function unlinkWa(waId: string) { await sql().query(`delete from ww_whatsapp where wa_id = $1`, [waId]); }
export async function waLinkedFor(userId: string) {
  const r = (await sql().query(`select hour, tz, lang from ww_whatsapp where user_id = $1`, [userId])) as unknown as { hour: number; tz: number; lang: string }[]; return r[0] ?? null;
}
export async function saveWaSchedule(userId: string, hour: number, tz: number, lang: string) {
  await sql().query(`update ww_whatsapp set hour = $2, tz = $3, lang = $4 where user_id = $1`, [userId, Math.min(23, Math.max(0, hour | 0)), Math.max(-720, Math.min(840, tz | 0)), lang === "en" ? "en" : "hi"]);
}
const openWindow = (waId: string) => sql().query(`update ww_whatsapp set window_until = now() + interval '24 hours' where wa_id = $1`, [waId]);

// ---------- inbound ----------
export interface InMessage { id: string; from: string; type: string; text?: string }
/** Pulls messages out of Meta's nested payload. Status updates, other fields and malformed entries are ignored, never trusted. */
export function extractMessages(payload: unknown): InMessage[] {
  const out: InMessage[] = []; const p = payload as { object?: string; entry?: { changes?: { field?: string; value?: { messages?: { id?: string; from?: string; type?: string; text?: { body?: string } }[] } }[] }[] };
  if (p?.object !== "whatsapp_business_account" || !Array.isArray(p.entry)) return out;
  for (const e of p.entry) for (const c of e.changes ?? []) {
    if (c.field !== "messages") continue;
    for (const m of c.value?.messages ?? []) if (typeof m?.id === "string" && typeof m.from === "string" && /^\d{7,15}$/.test(m.from)) out.push({ id: m.id, from: m.from, type: String(m.type ?? ""), text: m.type === "text" ? m.text?.body : undefined });
  }
  return out;
}

const buckets = new Map<string, number[]>();
const limited = (id: string) => { const t = Date.now(), a = (buckets.get(id) ?? []).filter(x => t - x < 60_000); a.push(t); buckets.set(id, a); return a.length > 12; };

export async function handleMessage(m: InMessage) {
  if (!(await firstTimeSeen(m.id))) return;                           // a retry of something we already handled
  if (limited(m.from)) return;
  await openWindow(m.from);                                            // they wrote to us: free-form replies are allowed for 24 hours
  if (m.type !== "text") { await waText(m.from, "I can read text messages. Send me one English word and I will tell you what it means."); return; }
  const cmd = parseWaCommand(m.text);
  switch (cmd.kind) {
    case "ignore": return;
    case "stop": await unlinkWa(m.from); await waText(m.from, "Stopped. You will not get daily words any more, and we have removed your number. You can still message me a word any time."); return;
    case "link":
      if (await consumeWaLink(cmd.code, m.from)) await waText(m.from, "✅ *Linked to Wordwild.*\nYou will get one word a day. Nothing to keep up with: skipped days cost nothing.\n\nYou can also send me any English word and I will tell you what it means. Send STOP any time to turn this off.");
      else await waText(m.from, "That link code did not work, or it has expired. Please make a new one in Wordwild under Settings.");
      return;
    case "help": case "start": await waText(m.from, "Send me one English word, like *skeptical*, and I will explain it in simple words.\nTo get a daily word, link me from Settings in Wordwild. Send STOP to turn the daily word off."); return;
    case "word": {
      const q = normalizeQuery(cmd.text);
      if (!isValidQuery(q)) { await waText(m.from, "Please send one English word, using letters only."); return; }
      const hit = await lookupDict(q);
      if (!hit) { await waText(m.from, `I do not have “${waSafe(q)}” yet. I will not guess.`); return; }
      const s = hit.senses[0];
      await waText(m.from, [`*${waSafe(s.lemma)}* _${waSafe(s.pos)}_`, "", waSafe(s.simple), s.explanations.hi ? `\n${waSafe(s.explanations.hi)}` : "", s.examples[0] ? `\n“${waSafe(s.examples[0].text)}”` : "",
        hit.senses.length > 1 ? `\n_${hit.senses.length} meanings. Open Wordwild to choose:_` : "", `${appUrl()}/capture?word=${encodeURIComponent(hit.matched)}`].filter(Boolean).join("\n"));
    }
  }
}

export async function handlePayload(payload: unknown) { for (const m of extractMessages(payload)) { try { await handleMessage(m); } catch (e) { console.error("wa message failed", (e as Error).message); } } }

// ---------- daily ----------
/** Hourly. One message per learner per local day. Inside the 24-hour window: free text. Outside: the approved template, or nothing if none is set up. */
export async function runDailyWhatsApp(now = Date.now()) {
  const rows = (await sql().query(`select user_id, wa_id, hour, tz, lang, last_sent_day, (window_until > to_timestamp($1 / 1000.0)) as in_window from ww_whatsapp`, [now])) as unknown as { user_id: string; wa_id: string; hour: number; tz: number; lang: string; last_sent_day: number; in_window: boolean }[];
  const template = env("WHATSAPP_DAILY_TEMPLATE"); const tplLang = env("WHATSAPP_TEMPLATE_LANG") || "en";
  let sent = 0, skipped = 0, quiet = 0, failed = 0, needsTemplate = 0;
  for (const r of rows) {
    const day = Math.floor((now + r.tz * 60_000) / 86_400_000);
    if (localHour(now, r.tz) !== r.hour || r.last_sent_day === day) { skipped++; continue; }
    try {
      const pick = await chooseForUser(r.user_id, now, r.tz);
      await sql().query(`update ww_whatsapp set last_sent_day = $2 where user_id = $1`, [r.user_id, day]);      // mark first: a crash must never cause a double send
      if (!pick) { quiet++; continue; }
      const lang = r.lang === "en" ? "en" : "hi"; let ok = false;
      if (r.in_window) ok = await waText(r.wa_id, `${dailyMessageWhatsApp(pick.kind, pick.w, lang, pick.from)}\n\n${appUrl()}/learn/${encodeURIComponent(pick.senseId)}`);
      else if (template) ok = await waTemplate(r.wa_id, template, tplLang, env("WHATSAPP_TEMPLATE_PARAMS") === "0" ? [] : [pick.w.lemma, pick.w.simple]);
      else { needsTemplate++; continue; }
      if (ok) sent++; else failed++;
    } catch (e) { failed++; console.error("wa daily failed", (e as Error).message); }
  }
  await sql().query(`delete from ww_wa_seen where at < now() - interval '3 days'`);                             // keep the replay table small
  return { learners: rows.length, sent, skipped, quiet, failed, needsTemplate };
}
