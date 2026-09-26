import { auth, currentUser } from "@clerk/nextjs/server";
import { limit } from "@/lib/ratelimit";
import { dbConfigured, ensureCircle, friendsBoard } from "@/lib/db";

export const runtime = "nodejs";

/** GET ?day=N -> { me: {name, code}, friends: [{pid, name}], rows: today's puzzle times for you and your friends }. Signed-in only. */
export async function GET(req: Request) {
  if (!dbConfigured()) return Response.json({ error: "not-configured" }, { status: 503 });
  const { userId } = await auth(); if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const lim = await limit(req, userId, "friends", 60, 60); if (lim) return lim;
  const day = Number(new URL(req.url).searchParams.get("day"));
  if (!Number.isInteger(day) || day < 1) return Response.json({ error: "bad-day" }, { status: 400 });
  try {
    const u = await currentUser();
    const me = await ensureCircle(userId, u?.firstName || u?.username || "A learner");
    const board = await friendsBoard(userId, day);
    return Response.json({ me: { name: me.name, code: me.code, pid: me.pid }, ...board }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { console.error("friends error", (e as Error).message); return Response.json({ error: "server-error" }, { status: 500 }); }
}
