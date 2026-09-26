import { auth } from "@clerk/nextjs/server";
import { claimQuota, dbConfigured, refundQuota } from "@/lib/db";
import { groqConfigured } from "@/lib/groq";
import { answerVoice } from "@/lib/voice";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_BYTES = 2 * 1024 * 1024;       // ~30 s of speech; short on purpose
const DAILY = 60;

/** POST multipart: audio=<file>. Signed-in only (cost). The recording is forwarded for transcription and never stored by us. */
export async function POST(req: Request) {
  if (!dbConfigured() || !groqConfigured()) return Response.json({ error: "not-configured" }, { status: 503 });
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES + 4096) return Response.json({ error: "too-large" }, { status: 413 });
  let file: File | null = null;
  try { const f = (await req.formData()).get("audio"); file = f instanceof File ? f : null; } catch { return Response.json({ error: "bad-form" }, { status: 400 }); }
  if (!file || file.size < 500) return Response.json({ error: "no-audio" }, { status: 400 });
  if (file.size > MAX_BYTES || !/^(audio|video)\//.test(file.type)) return Response.json({ error: "bad-audio" }, { status: 413 });
  const key = `v:${userId}`;
  if (!(await claimQuota(key, DAILY))) return Response.json({ error: "quota", perDay: DAILY }, { status: 429 });
  try {
    return Response.json(await answerVoice(await file.arrayBuffer(), file.name || "speech.webm", file.type));
  } catch (e) {
    await refundQuota(key);
    console.error("voice error", (e as Error).message);
    return Response.json({ error: "busy" }, { status: 503, headers: { "Retry-After": "20" } });
  }
}
