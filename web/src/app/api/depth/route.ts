import { auth } from "@clerk/nextjs/server";
import { DEPTH_PROMPT_VERSION, isSenseId, makeDepth } from "@core";
import { claimQuota, dbConfigured, getDepth, getDictSense, lemmaExists, putDepth, refundQuota } from "@/lib/db";
import { MODEL_GENERATE, draftDepth, groqConfigured, solveBlind } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 60;
const DAILY = 20;

/** POST { senseId } -> { depth }. Cached and shared; generating needs sign-in (cost control). Nothing is returned unless a blind solver confirmed it. */
export async function POST(req: Request) {
  if (!dbConfigured()) return Response.json({ error: "not-configured" }, { status: 503 });
  let id: unknown; let onlyCached = false;
  try { const b = (await req.json()) as { senseId?: unknown; onlyCached?: unknown }; id = b.senseId; onlyCached = b.onlyCached === true; } catch { return Response.json({ error: "bad-json" }, { status: 400 }); }
  if (!isSenseId(id) || !id.includes("%")) return Response.json({ error: "bad-id" }, { status: 400 });
  try {
    const cached = await getDepth(id, DEPTH_PROMPT_VERSION);
    if (cached) return Response.json({ depth: cached, cached: true });
    if (onlyCached) return Response.json({ error: "not-ready" }, { status: 404 });      // a free check: no auth, no AI, no quota
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
    if (!groqConfigured()) return Response.json({ error: "enrichment-not-configured" }, { status: 503 });
    const base = await getDictSense(id); if (!base) return Response.json({ error: "not-found" }, { status: 404 });
    const quotaKey = `d:${userId}`;
    if (!(await claimQuota(quotaKey, DAILY))) return Response.json({ error: "quota", perDay: DAILY }, { status: 429 });
    const out = await makeDepth(base.lemma, () => draftDepth({ lemma: base.lemma, pos: base.pos, definition: base.definition, synonyms: base.nearSynonyms.map(n => n.lemma) }), solveBlind, MODEL_GENERATE, lemmaExists);
    if (!out.ok && out.transient) { await refundQuota(quotaKey); return Response.json({ error: "busy" }, { status: 503, headers: { "Retry-After": "30" } }); }
    if (!out.ok) return Response.json({ error: "rejected", stage: out.stage }, { status: 422 });
    await putDepth(id, out.depth, MODEL_GENERATE, DEPTH_PROMPT_VERSION);
    return Response.json({ depth: out.depth, cached: false });
  } catch (e) { console.error("depth error", (e as Error).message); return Response.json({ error: "server-error" }, { status: 502 }); }
}
