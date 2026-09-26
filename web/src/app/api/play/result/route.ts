import { auth } from "@clerk/nextjs/server";
import { dayIndex, LEVELS } from "@core";
import { dbConfigured, saveResult } from "@/lib/db";

export const runtime = "nodejs";

/** POST { game, day, level, ms, tries, won }. Signed-in players only; the first result for a puzzle and day is the one that counts. */
export async function POST(req: Request) {
  if (!dbConfigured()) return Response.json({ ok: false }, { status: 503 });
  const { userId } = await auth(); if (!userId) return Response.json({ ok: false }, { status: 401 });
  let b: Record<string, unknown>; try { b = await req.json(); } catch { return Response.json({ ok: false }, { status: 400 }); }
  const game = String(b.game), level = String(b.level), day = Number(b.day), ms = Number(b.ms), tries = Number(b.tries), won = b.won === true;
  const today = dayIndex(Date.now(), 0);
  const ok = ["word", "unscramble", "match"].includes(game) && (level === "-" || (LEVELS as readonly string[]).includes(level))
    && Number.isInteger(day) && Math.abs(day - today) <= 1 && Number.isInteger(ms) && ms >= 1500 && ms <= 3_600_000 && Number.isInteger(tries) && tries >= 0 && tries <= 99;
  if (!ok) return Response.json({ ok: false }, { status: 400 });
  try { await saveResult(userId, { game, day, level, ms, tries, won }); return Response.json({ ok: true }); } catch { return Response.json({ ok: false }, { status: 500 }); }
}
