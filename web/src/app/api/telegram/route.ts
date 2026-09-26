import { timingSafeEqual } from "node:crypto";
import { handleUpdate, telegramConfigured } from "@/lib/telegram";
import { dbConfigured } from "@/lib/db";

export const runtime = "nodejs";
const safe = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Telegram webhook. Only Telegram (holding the secret we registered) can call it. */
export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!telegramConfigured() || !dbConfigured() || !secret) return Response.json({ error: "not-configured" }, { status: 503 });
  if (!safe(req.headers.get("x-telegram-bot-api-secret-token") ?? "", secret)) return Response.json({ error: "forbidden" }, { status: 403 });
  let update: unknown; try { update = await req.json(); } catch { return Response.json({ ok: true }); }
  try { await handleUpdate(update as Parameters<typeof handleUpdate>[0]); } catch (e) { console.error("telegram update", (e as Error).message); }
  return Response.json({ ok: true });            // always 200 so Telegram does not retry a bad message forever
}
