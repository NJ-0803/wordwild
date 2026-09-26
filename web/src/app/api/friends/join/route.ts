import { auth, currentUser } from "@clerk/nextjs/server";
import { limit } from "@/lib/ratelimit";
import { dbConfigured, ensureCircle, joinCircle } from "@/lib/db";

export const runtime = "nodejs";

/** POST { code } -> links you and the owner of the invite code as friends (both ways). */
export async function POST(req: Request) {
  if (!dbConfigured()) return Response.json({ error: "not-configured" }, { status: 503 });
  const { userId } = await auth(); if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const lim = await limit(req, userId, "join", 10, 600); if (lim) return lim;
  let code: unknown; try { code = ((await req.json()) as { code?: unknown }).code; } catch { return Response.json({ error: "bad-json" }, { status: 400 }); }
  if (typeof code !== "string" || !/^[a-z2-9]{10}$/.test(code)) return Response.json({ error: "bad-code" }, { status: 400 });
  try {
    const u = await currentUser(); await ensureCircle(userId, u?.firstName || u?.username || "A learner");
    const r = await joinCircle(userId, code);
    return Response.json({ result: r }, { status: r === "unknown" ? 404 : 200 });
  } catch (e) { console.error("join error", (e as Error).message); return Response.json({ error: "server-error" }, { status: 500 }); }
}
