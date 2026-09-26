import { auth } from "@clerk/nextjs/server";
import { dbConfigured } from "@/lib/db";
import { makeWaLink, saveWaSchedule, unlinkWa, waLinkedFor, whatsappConfigured } from "@/lib/whatsapp";
import { sql } from "@/lib/sql";

export const runtime = "nodejs";
const configured = () => dbConfigured() && whatsappConfigured() && /^\d{7,15}$/.test(process.env.WHATSAPP_BUSINESS_NUMBER ?? "");

/** GET: linked? POST: make a one-time link (opens WhatsApp with "LINK code" ready to send). PUT: hour / language. DELETE: unlink. */
export async function GET() {
  const { userId } = await auth(); if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(configured() ? { configured: true, linked: await waLinkedFor(userId) } : { configured: false });
}
export async function POST() {
  const { userId } = await auth(); if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!configured()) return Response.json({ error: "not-configured" }, { status: 503 });
  return Response.json({ url: `https://wa.me/${process.env.WHATSAPP_BUSINESS_NUMBER}?text=${encodeURIComponent(`LINK ${await makeWaLink(userId)}`)}` });
}
export async function PUT(req: Request) {
  const { userId } = await auth(); if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({})) as { hour?: unknown; tz?: unknown; lang?: unknown };
  if (!Number.isFinite(b.hour) || !Number.isFinite(b.tz)) return Response.json({ error: "bad-input" }, { status: 400 });
  await saveWaSchedule(userId, Number(b.hour), Number(b.tz), String(b.lang)); return Response.json({ ok: true });
}
export async function DELETE() {
  const { userId } = await auth(); if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const r = (await sql().query(`select wa_id from ww_whatsapp where user_id = $1`, [userId])) as unknown as { wa_id: string }[];
  if (r[0]) await unlinkWa(r[0].wa_id); return Response.json({ ok: true });
}
