import { auth } from "@clerk/nextjs/server";
import { claimQuota, dbConfigured } from "@/lib/db";
import { groqConfigured, senseFromContext } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST { word, sentence, meanings } -> { index | null }. "Which of these meanings fits the sentence the person heard the word in?"
 * A suggestion only: the person still chooses. Needs sign-in (cost control). Only the word, the sentence and the meanings are sent to the model.
 */
export async function POST(req: Request) {
  let b: { word?: unknown; sentence?: unknown; meanings?: unknown };
  try { b = await req.json(); } catch { return Response.json({ error: "bad-json" }, { status: 400 }); }
  const ok = (t: unknown, max: number): t is string => typeof t === "string" && t.trim().length > 0 && t.length <= max;
  if (!ok(b.word, 48) || !ok(b.sentence, 300) || !Array.isArray(b.meanings) || b.meanings.length < 2 || b.meanings.length > 12 || !b.meanings.every(m => ok(m, 300)))
    return Response.json({ error: "bad-input" }, { status: 400 });
  if (!dbConfigured() || !groqConfigured()) return Response.json({ error: "not-configured" }, { status: 503 });
  const { userId } = await auth(); if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!(await claimQuota(`s:${userId}`, 80))) return Response.json({ error: "quota" }, { status: 429 });
  try { const i = await senseFromContext(b.word, b.sentence, b.meanings as string[]); return Response.json({ index: i >= 0 && i < b.meanings.length ? i : null }); }
  catch { return Response.json({ index: null }); }                       // a hint that fails is just no hint
}
