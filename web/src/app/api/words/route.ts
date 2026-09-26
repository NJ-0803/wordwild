import { cleanInput } from "@core";
import { dbConfigured, lookupDict } from "@/lib/db";

export const runtime = "nodejs";

// Best-effort per-caller limit, in memory. Public reference data, so this only stops accidents and abuse.
const recent = new Map<string, number[]>();
const limited = (k: string) => { const n = Date.now(); const r = (recent.get(k) ?? []).filter(t => n - t < 10_000); r.push(n); recent.set(k, r); if (recent.size > 5000) recent.clear(); return r.length > 12; };

/**
 * POST { words: string[] (max 10) } -> { items: [{ word, lemma, pos, simple, more, note? }] }
 * The most common meaning of each word (dictionary text as published), used when hovering a sentence to show what its words mean.
 * Words the dictionary does not know are simply left out. Nothing is guessed.
 */
export async function POST(req: Request) {
  if (!dbConfigured()) return Response.json({ items: [] }, { status: 503 });
  if (limited(req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local")) return Response.json({ items: [] }, { status: 429, headers: { "Retry-After": "10" } });
  let words: unknown; try { words = ((await req.json()) as { words?: unknown }).words; } catch { return Response.json({ items: [] }, { status: 400 }); }
  if (!Array.isArray(words)) return Response.json({ items: [] }, { status: 400 });
  const uniq = [...new Set(words.slice(0, 10).map(w => cleanInput(w).query).filter(q => q && !q.includes(" ")))].slice(0, 10);
  try {
    const items = (await Promise.all(uniq.map(async w => {
      const hit = await lookupDict(w); if (!hit) return null;
      const s = hit.senses[0];
      return { word: w, lemma: s.lemma, pos: s.pos, simple: s.simple.slice(0, 160), more: Math.max(0, hit.senses.length - 1), ...(hit.note ? { note: hit.note } : {}) };
    }))).filter((x): x is NonNullable<typeof x> => !!x);
    return Response.json({ items }, { headers: { "Cache-Control": "private, max-age=600" } });
  } catch { return Response.json({ items: [] }, { status: 502 }); }
}
