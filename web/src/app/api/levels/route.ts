import { auth } from "@clerk/nextjs/server";
import { cleanOcrWord, heuristicLevel } from "@core";
import { claimQuota, dbConfigured, getLevels, putLevels } from "@/lib/db";
import { MODEL_GENERATE, groqConfigured, predictLevels } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 60;
const DAILY = 40;

/**
 * POST { words: [..up to 40..] } -> { levels: { word: { level, source } } }
 * Cached AI difficulty is free for everyone. New words are judged by the AI for signed-in learners only (quota), otherwise a labelled heuristic is returned.
 */
export async function POST(req: Request) {
  if (!dbConfigured()) return Response.json({ error: "not-configured" }, { status: 503 });
  let raw: unknown; try { raw = ((await req.json()) as { words?: unknown }).words; } catch { return Response.json({ error: "bad-json" }, { status: 400 }); }
  const words = [...new Set((Array.isArray(raw) ? raw : []).map(w => cleanOcrWord(String(w))).filter((w): w is string => !!w && /^[a-z'-]+$/.test(w)))].slice(0, 40);
  if (!words.length) return Response.json({ levels: {} });
  try {
    const known = await getLevels(words);
    const missing = words.filter(w => !known.has(w));
    const { userId } = await auth();
    if (missing.length && userId && groqConfigured() && (await claimQuota(`l:${userId}`, DAILY))) {
      try {
        const got = await predictLevels(missing); await putLevels(got, MODEL_GENERATE);
        got.forEach(g => known.set(g.lemma, { level: g.level, topics: g.topics, source: "ai" }));
      } catch (e) { console.error("levels failed", (e as Error).message); }
    }
    const levels: Record<string, { level: number; source: string }> = {};
    for (const w of words) { const k = known.get(w); levels[w] = k ? { level: k.level, source: k.source } : { level: heuristicLevel(w, 2, false), source: "heuristic" }; }
    return Response.json({ levels }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { console.error("levels error", (e as Error).message); return Response.json({ error: "server-error" }, { status: 502 }); }
}
