import { auth } from "@clerk/nextjs/server";
import { COACH_PROMPT_VERSION, isSenseId, makeCoach } from "@core";
import { claimQuota, dbConfigured, firstDefinition, getCoach, getDictSense, lookupDict, putCoach, refundQuota } from "@/lib/db";
import { MODEL_GENERATE, draftCoach, groqConfigured, solveBlind, solveMany, lastUsed } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 60;
const DAILY = 20;              // per signed-in learner
const ANON_DAILY = Number(process.env.COACH_ANON_DAILY ?? 300);   // shared by everyone who is not signed in: the free AI allowance is finite
const recent = new Map<string, number[]>();   // in-memory burst limit per caller; never stored
const burst = (k: string) => { const n = Date.now(); const r = (recent.get(k) ?? []).filter(t => n - t < 60_000); r.push(n); recent.set(k, r); if (recent.size > 5000) recent.clear(); return r.length > 6; };

/**
 * POST { senseId, onlyCached? } -> { coach }. Cached and shared; generating needs sign-in (cost control).
 * Nothing is returned unless it passed the checks and a blind solver confirmed it. Response carries Server-Timing so speed can be seen.
 */
export async function POST(req: Request) {
  const t0 = performance.now();
  const res = await handle(req);
  res.headers.set("Server-Timing", `total;dur=${(performance.now() - t0).toFixed(0)}`);
  return res;
}
async function handle(req: Request): Promise<Response> {
  if (!dbConfigured()) return Response.json({ error: "not-configured" }, { status: 503 });
  let id: unknown; let onlyCached = false;
  try { const b = (await req.json()) as { senseId?: unknown; onlyCached?: unknown }; id = b.senseId; onlyCached = b.onlyCached === true; } catch { return Response.json({ error: "bad-json" }, { status: 400 }); }
  if (!isSenseId(id) || !id.includes("%")) return Response.json({ error: "bad-id" }, { status: 400 });
  try {
    const cached = await getCoach(id, COACH_PROMPT_VERSION);
    if (cached) return Response.json({ coach: cached, cached: true });
    if (onlyCached) return Response.json({ error: "not-ready" }, { status: 404 });
    // Anyone may ask for help on a word that has none yet: it is generated once and then shared with everyone. Signed-in learners have their
    // own daily allowance; everyone else draws on a shared daily budget, so the free AI allowance cannot be drained by one visitor.
    const { userId } = await auth();
    if (!userId && burst(req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local")) return Response.json({ error: "busy" }, { status: 429, headers: { "Retry-After": "30" } });
    if (!groqConfigured()) return Response.json({ error: "enrichment-not-configured" }, { status: 503 });
    const base = await getDictSense(id); if (!base) return Response.json({ error: "not-found" }, { status: 404 });
    const quotaKey = userId ? `c:${userId}` : "c:anon";
    if (!(await claimQuota(quotaKey, userId ? DAILY : ANON_DAILY))) return Response.json({ error: userId ? "quota" : "quota-shared", perDay: userId ? DAILY : ANON_DAILY }, { status: 429 });
    const sib = (await lookupDict(base.lemma))?.senses.filter(x => x.lemma === base.lemma && x.senseId !== id) ?? [];
    let writer = "";      // which model wrote the draft (not the one that checked it)
    const out = await makeCoach(base.lemma, { definition: base.definition, pos: base.pos, checkPos: sib.some(x => x.pos !== base.pos), decoys: sib.map(x => x.definition).slice(0, 2) },
      async (problems) => { const d = await draftCoach({ lemma: base.lemma, pos: base.pos, definition: base.definition, synonyms: base.nearSynonyms.map(n => n.lemma) }, problems); writer = lastUsed; return d; }, solveBlind, () => writer || MODEL_GENERATE, firstDefinition, solveMany);
    if (!out.ok && out.transient) { await refundQuota(quotaKey); return Response.json({ error: "busy" }, { status: 503, headers: { "Retry-After": "30" } }); }
    if (!out.ok) return Response.json({ error: "rejected", stage: out.stage }, { status: 422 });
    await putCoach(id, out.coach, out.coach.generatedBy, COACH_PROMPT_VERSION);
    return Response.json({ coach: out.coach, cached: false });
  } catch (e) { console.error("coach error", (e as Error).message); return Response.json({ error: "server-error" }, { status: 502 }); }
}
