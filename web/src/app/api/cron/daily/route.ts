import { timingSafeEqual } from "node:crypto";
import { runDaily, telegramConfigured } from "@/lib/telegram";
import { runDailyWhatsApp, whatsappConfigured } from "@/lib/whatsapp";
import { dbConfigured } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Hourly job (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`). Sends at most one word per learner per local day. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET; const got = req.headers.get("authorization") ?? "";
  if (!secret || got.length !== `Bearer ${secret}`.length || !timingSafeEqual(Buffer.from(got), Buffer.from(`Bearer ${secret}`))) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!dbConfigured() || !(telegramConfigured() || whatsappConfigured())) return Response.json({ error: "not-configured" }, { status: 503 });
  const [telegram, whatsapp] = await Promise.all([telegramConfigured() ? runDaily() : null, whatsappConfigured() ? runDailyWhatsApp() : null]);
  return Response.json({ telegram, whatsapp });
}
