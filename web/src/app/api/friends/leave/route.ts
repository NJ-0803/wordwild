import { auth } from "@clerk/nextjs/server";
import { dbConfigured, leaveFriend } from "@/lib/db";

export const runtime = "nodejs";

/** POST { pid } -> removes that friend from your list, and you from theirs. */
export async function POST(req: Request) {
  if (!dbConfigured()) return Response.json({ error: "not-configured" }, { status: 503 });
  const { userId } = await auth(); if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  let pid: unknown; try { pid = ((await req.json()) as { pid?: unknown }).pid; } catch { return Response.json({ error: "bad-json" }, { status: 400 }); }
  if (typeof pid !== "string" || !/^[a-z2-9]{8}$/.test(pid)) return Response.json({ error: "bad-pid" }, { status: 400 });
  try { await leaveFriend(userId, pid); return Response.json({ ok: true }); } catch { return Response.json({ error: "server-error" }, { status: 500 }); }
}
