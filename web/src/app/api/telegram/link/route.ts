import { limitUser } from "@/lib/ratelimit";
import { auth } from "@clerk/nextjs/server";
import { linkedFor, makeLinkCode, saveSchedule, telegramConfigured, unlinkChat } from "@/lib/telegram";
import { dbConfigured } from "@/lib/db";
import { sql } from "@/lib/sql";

export const runtime = "nodejs";

/** GET: is Telegram linked? POST: make a one-time link (10 minutes). PUT: choose hour / language. DELETE: unlink. */
export async function GET() {
  const { userId } = await auth(); if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!dbConfigured() || !telegramConfigured() || !process.env.TELEGRAM_BOT_USERNAME) return Response.json({ configured: false });
  return Response.json({ configured: true, linked: await linkedFor(userId) });
}
export async function POST() {
  const { userId } = await auth(); if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  { const lim = await limitUser(userId, "link", 20, 600); if (lim) return lim; }
  const bot = process.env.TELEGRAM_BOT_USERNAME;
  if (!dbConfigured() || !telegramConfigured() || !bot) return Response.json({ error: "not-configured" }, { status: 503 });
  return Response.json({ url: `https://t.me/${bot}?start=${await makeLinkCode(userId)}` });
}
export async function PUT(req: Request) {
  const { userId } = await auth(); if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  { const lim = await limitUser(userId, "link", 20, 600); if (lim) return lim; }
  const b = await req.json().catch(() => ({})) as { hour?: unknown; tz?: unknown; lang?: unknown };
  if (!Number.isFinite(b.hour) || !Number.isFinite(b.tz)) return Response.json({ error: "bad-input" }, { status: 400 });
  await saveSchedule(userId, Number(b.hour), Number(b.tz), String(b.lang)); return Response.json({ ok: true });
}
export async function DELETE() {
  const { userId } = await auth(); if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  { const lim = await limitUser(userId, "link", 20, 600); if (lim) return lim; }
  const r = (await sql().query(`select chat_id from ww_telegram where user_id = $1`, [userId])) as unknown as { chat_id: string }[];
  if (r[0]) await unlinkChat(Number(r[0].chat_id)); return Response.json({ ok: true });
}
