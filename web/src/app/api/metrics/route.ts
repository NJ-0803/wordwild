import { sanitizeDevice, sanitizeMetric } from "@core";
import { dbConfigured } from "@/lib/db";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";

// Best-effort per-device rate limit, in memory. It only stops accidents and abuse; it stores nothing about anyone.
const seen = new Map<string, number[]>();
const limited = (d: string) => { const n = Date.now(); const r = (seen.get(d) ?? []).filter(t => n - t < 60_000); r.push(n); seen.set(d, r); if (seen.size > 5000) seen.clear(); return r.length > 30; };

/**
 * POST { device, events: [{ name, label? }] }. Anonymous counts only. Anything not on the fixed lists is dropped (see core/metrics.ts).
 * The request's IP address and headers are never read or stored. Always answers 204 so the page never waits on or reacts to it.
 */
export async function POST(req: Request) {
  try {
    if (!dbConfigured()) return new Response(null, { status: 204 });
    const b = (await req.json()) as { device?: unknown; events?: unknown };
    const device = sanitizeDevice(b.device); if (!device || !Array.isArray(b.events) || limited(device)) return new Response(null, { status: 204 });
    const events = b.events.slice(0, 12).map(sanitizeMetric).filter((e): e is NonNullable<typeof e> => !!e);
    if (!events.length) return new Response(null, { status: 204 });
    const day = Math.floor(Date.now() / 86_400_000);
    const rows = JSON.stringify(events.map(e => ({ name: e.name, label: e.label ?? null })));
    await neon(process.env.DATABASE_URL!).query(`insert into ww_metrics (device, day, name, label) select $1, $2, x.name, x.label from jsonb_to_recordset($3::jsonb) as x(name text, label text)`, [device, day, rows]);
  } catch { /* measurement must never break the app */ }
  return new Response(null, { status: 204 });
}
