import { auth } from "@clerk/nextjs/server";
import { INTERESTS, isSenseId, selectConstellation, type Candidate } from "@core";
import { claimQuota, dbConfigured, getDictSense, getPool, getLevels, putPool } from "@/lib/db";
import { buildPool } from "@/lib/constellation";
import { CONSTELLATION_PROMPT_VERSION, MODEL_GENERATE, groqConfigured } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 60;
const BUILD_QUOTA_PER_DAY = 40;      // building a new pool costs AI calls; cached pools are free

/**
 * POST { senseId, learner: { level, interests, purpose }, exclude: [lemma] }
 * -> { target: { lemma, level }, picks: [...], mode: "ai" | "dictionary-only" }
 * The pool for a word is built once (AI + dictionary) and cached for everybody; choosing WHICH words to show this learner is pure and free.
 * Signed-out visitors get the cached pool or a dictionary-only pool; only signed-in learners can trigger new AI work.
 */
export async function POST(req: Request) {
  if (!dbConfigured()) return Response.json({ error: "not-configured" }, { status: 503 });
  let body: { senseId?: unknown; learner?: { level?: unknown; interests?: unknown; purpose?: unknown }; exclude?: unknown };
  try { body = await req.json(); } catch { return Response.json({ error: "bad-json" }, { status: 400 }); }
  const id = body.senseId;
  if (!isSenseId(id) || !id.includes("%")) return Response.json({ error: "bad-id" }, { status: 400 });
  const level = Number(body.learner?.level);
  if (!Number.isFinite(level) || level < 1 || level > 5) return Response.json({ error: "bad-level" }, { status: 400 });
  const interests = Array.isArray(body.learner?.interests) ? (body.learner!.interests as unknown[]).filter((x): x is string => typeof x === "string" && (INTERESTS as readonly string[]).includes(x)).slice(0, 6) : [];
  const purpose = typeof body.learner?.purpose === "string" ? body.learner.purpose.slice(0, 12) : undefined;
  const exclude = new Set((Array.isArray(body.exclude) ? body.exclude : []).filter((x): x is string => typeof x === "string" && x.length <= 48).slice(0, 300));

  try {
    const base = await getDictSense(id);
    if (!base) return Response.json({ error: "not-found" }, { status: 404 });
    const { userId } = await auth();

    let pool: Candidate[] | null = await getPool(id, CONSTELLATION_PROMPT_VERSION);   // older-version pools are rebuilt
    let mode: "ai" | "dictionary-only" = "ai";
    if (!pool) {
      const allowAi = !!userId && groqConfigured() && (await claimQuota(`c:${userId}`, BUILD_QUOTA_PER_DAY));
      const built = await buildPool(base, { ai: allowAi });
      pool = built.candidates;
      if (built.ai) await putPool(id, pool, MODEL_GENERATE, CONSTELLATION_PROMPT_VERSION); else mode = "dictionary-only";
    }
    const target = (await getLevels([base.lemma])).get(base.lemma);
    const picks = selectConstellation({ target: { lemma: base.lemma, level: target?.level ?? 3 }, learner: { level, interests, purpose }, candidates: pool, known: exclude });
    return Response.json({ target: { lemma: base.lemma, level: target?.level ?? 3 }, picks, mode }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("constellation error", (e as Error).message);
    return Response.json({ error: "server-error" }, { status: 502 });
  }
}
