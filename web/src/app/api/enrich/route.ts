import { auth } from "@clerk/nextjs/server";
import { enrich, isSenseId, PROMPT_VERSION, tierOf } from "@core";
import { claimQuota, dbConfigured, getDictSense, getEnriched, putEnriched, putFailure, recentFailure, refundQuota } from "@/lib/db";
import { generateDraft, groqConfigured, MODEL_GENERATE, MODEL_VERIFY, solveBlind } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 60;
const DAILY_PER_USER = 15;

/**
 * POST { senseId } -> { sense }  (validated enriched lesson, cached for everyone)
 * Requires sign-in so cost can be bounded per learner. Nothing generated is returned unless every gate passed.
 */
export async function POST(req: Request) {
  if (!dbConfigured()) return Response.json({ error: "not-configured" }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  let id: unknown; try { id = ((await req.json()) as { senseId?: unknown }).senseId; } catch { return Response.json({ error: "bad-json" }, { status: 400 }); }
  if (!isSenseId(id) || !id.includes("%")) return Response.json({ error: "bad-id" }, { status: 400 });
  try {
    const cached = await getEnriched(id);
    if (cached) return Response.json({ sense: cached, cached: true });                       // free: already generated and validated
    if (!groqConfigured()) return Response.json({ error: "enrichment-not-configured" }, { status: 503 });
    const base = await getDictSense(id);
    if (!base) return Response.json({ error: "not-found" }, { status: 404 });
    if (tierOf(base) !== "dictionary") return Response.json({ sense: base, cached: true });
    const failed = await recentFailure(id);
    if (failed) return Response.json({ error: "rejected", stage: failed.stage }, { status: 422 });   // do not pay to retry a word that just failed
    if (!(await claimQuota(userId, DAILY_PER_USER))) return Response.json({ error: "quota", perDay: DAILY_PER_USER }, { status: 429 });

    const out = await enrich(base, m => generateDraft(m), solveBlind, MODEL_GENERATE);
    if (!out.ok && out.transient) {           // our infrastructure, not this word: do not remember it, give the quota back
      await refundQuota(userId);
      return Response.json({ error: "busy" }, { status: 503, headers: { "Retry-After": "30" } });
    }
    if (!out.ok) { await putFailure(id, out.stage, out.problems); return Response.json({ error: "rejected", stage: out.stage }, { status: 422 }); }
    await putEnriched(id, out.sense, MODEL_GENERATE, MODEL_VERIFY, PROMPT_VERSION);
    return Response.json({ sense: out.sense, cached: false });
  } catch (e) {
    console.error("enrich error", (e as Error).message);
    return Response.json({ error: "server-error" }, { status: 502 });
  }
}
