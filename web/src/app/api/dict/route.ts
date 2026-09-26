import { cleanInput, isSenseId } from "@core";
import { dbConfigured, getDictSense, lookupDict, suggestLemmas } from "@/lib/db";

export const runtime = "nodejs";

// Public reference data, but still rate limited per client (best effort: per-instance memory).
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now(); const r = (hits.get(ip) ?? []).filter(t => now - t < 10_000); r.push(now); hits.set(ip, r); return r.length > 40;
}
const cache = { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" };

/** GET /api/dict?q=word  -> { status, senses, matched }   |   GET /api/dict?id=<senseKey> -> { sense } */
export async function GET(req: Request) {
  const t0 = performance.now();
  const res = await handle(req);
  res.headers.set("Server-Timing", `total;dur=${(performance.now() - t0).toFixed(0)}`);          // lets anyone see how long the server itself took
  return res;
}
async function handle(req: Request): Promise<Response> {
  if (!dbConfigured()) return Response.json({ status: "pending", reason: "dictionary-not-configured" }, { status: 503 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (limited(ip)) return Response.json({ error: "rate-limited" }, { status: 429, headers: { "Retry-After": "10" } });
  const url = new URL(req.url);
  try {
    const id = url.searchParams.get("id");
    if (id !== null) {
      if (!isSenseId(id)) return Response.json({ error: "bad-id" }, { status: 400 });
      const sense = await getDictSense(id);
      return sense ? Response.json({ sense }, { headers: cache }) : Response.json({ error: "not-found" }, { status: 404 });
    }
    const cleaned = cleanInput(url.searchParams.get("q") ?? "");
    // Not a word we can look up: say why, in plain words. Still HTTP 200 so callers treat it as an answer, not an outage.
    if (!cleaned.query) return Response.json({ status: "unsearchable", kind: cleaned.kind, message: cleaned.message }, { headers: cache });
    const q = cleaned.query;
    const hit = await lookupDict(q);
    if (hit) return Response.json({ status: "found", senses: hit.senses, matched: hit.matched, notes: hit.notes, note: hit.note, source: "wordnet" }, { headers: cache });
    const suggestions = await suggestLemmas(q);
    return Response.json({ status: "unknown", query: q, kind: cleaned.kind, note: cleaned.note, suggestions }, { headers: cache });
  } catch (e) {
    console.error("dict error", (e as Error).message);
    return Response.json({ status: "pending", reason: "provider-unavailable" }, { status: 502 });
  }
}
