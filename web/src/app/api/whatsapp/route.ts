import { dbConfigured } from "@/lib/db";
import { handlePayload, verifyHandshake, verifySignature, whatsappConfigured } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const maxDuration = 30;

/** GET: Meta's one-time handshake when you register the webhook. */
export async function GET(req: Request) {
  const challenge = verifyHandshake(new URL(req.url).searchParams, process.env.WHATSAPP_VERIFY_TOKEN ?? "");
  return challenge === null ? new Response("forbidden", { status: 403 }) : new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
}

/** POST: messages from learners. Only Meta (holding the app secret) can produce a valid signature. */
export async function POST(req: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET ?? "";
  if (!whatsappConfigured() || !dbConfigured() || !secret) return Response.json({ error: "not-configured" }, { status: 503 });
  if (Number(req.headers.get("content-length") ?? 0) > 256 * 1024) return Response.json({ error: "too-large" }, { status: 413 });
  const raw = await req.text();                                   // the signature is over the exact bytes received, so read them raw
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), secret)) return Response.json({ error: "forbidden" }, { status: 403 });
  let payload: unknown; try { payload = JSON.parse(raw); } catch { return Response.json({ ok: true }); }
  await handlePayload(payload);
  return Response.json({ ok: true });                             // always 200 for valid signatures so Meta does not retry forever
}
