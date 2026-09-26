import { auth } from "@clerk/nextjs/server";
import { sanitizeEvents, sanitizePrefs } from "@core";
import { limitUser } from "@/lib/ratelimit";
import { dbConfigured, deleteAll, dictIdsExist, loadAll, saveEvents } from "@/lib/db";

export const runtime = "nodejs";
const MAX_BODY = 512 * 1024;

// Best-effort per-instance limiter (serverless instances do not share memory). A real quota needs a shared store.
const hits = new Map<string, number[]>();
function limited(userId: string) {
  const now = Date.now(); const recent = (hits.get(userId) ?? []).filter(t => now - t < 10_000);
  recent.push(now); hits.set(userId, recent); return recent.length > 20;
}

async function guard() {
  if (!dbConfigured()) return { res: Response.json({ error: "sync-not-configured" }, { status: 503 }) };
  const { userId } = await auth();
  if (!userId) return { res: Response.json({ error: "unauthorized" }, { status: 401 }) };
  if (limited(userId)) return { res: Response.json({ error: "rate-limited" }, { status: 429, headers: { "Retry-After": "10" } }) };
  { const lim = await limitUser(userId, "sync", 240, 60); if (lim) return { res: lim }; }
  return { userId };
}
const fail = (e: unknown) => { console.error("sync error", (e as Error).message); return Response.json({ error: "server-error" }, { status: 500 }); };

/** Everything this learner has stored. Doubles as the data export. */
export async function GET() {
  const g = await guard(); if ("res" in g) return g.res;
  try { return Response.json(await loadAll(g.userId!), { headers: { "Cache-Control": "no-store" } }); } catch (e) { return fail(e); }
}

/** Push new events (idempotent), get back the merged set. */
export async function POST(req: Request) {
  const g = await guard(); if ("res" in g) return g.res;
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return Response.json({ error: "too-large" }, { status: 413 });
  let body: unknown; try { body = await req.json(); } catch { return Response.json({ error: "bad-json" }, { status: 400 }); }
  try {
    const b = body as { prefs?: unknown; prefsUpdatedAt?: unknown };
    const at = Number.isFinite(b?.prefsUpdatedAt) ? Number(b.prefsUpdatedAt) : 0;
    const ev = sanitizeEvents(body);
    const wn = [...new Set([...ev.captures.map(c => c.senseId), ...ev.attempts.map(a => a.senseId)].filter((id): id is string => !!id && id.includes("%")))];
    const real = await dictIdsExist(wn);          // a client cannot invent dictionary senses
    ev.captures = ev.captures.filter(c => !c.senseId || !c.senseId.includes("%") || real.has(c.senseId));
    ev.attempts = ev.attempts.filter(a => !a.senseId.includes("%") || real.has(a.senseId));
    await saveEvents(g.userId!, ev, sanitizePrefs(b?.prefs), at);
    return Response.json(await loadAll(g.userId!), { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return fail(e); }
}

/** Delete everything stored for this learner. */
export async function DELETE() {
  const g = await guard(); if ("res" in g) return g.res;
  try { await deleteAll(g.userId!); return Response.json({ deleted: true }); } catch (e) { return fail(e); }
}
