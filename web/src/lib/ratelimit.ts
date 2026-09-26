import { hit } from "./db";

export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
/** 429 response to send when a limit is hit. */
export const tooMany = (retry = 30) => Response.json({ error: "rate-limited" }, { status: 429, headers: { "Retry-After": String(retry) } });

/**
 * Shared, per-person and per-address limits. `name` groups a route's budget. Returns a Response to send back when limited, or null to carry on.
 * The address limit is looser than the person limit so shared networks (a school, a family) are not locked out.
 */
export async function limit(req: Request, userId: string | null, name: string, perUser: number, windowSec: number): Promise<Response | null> {
  if (userId && (await hit(`u:${name}:${userId}`, perUser, windowSec))) return tooMany(windowSec);
  if (await hit(`ip:${name}:${clientIp(req)}`, perUser * 4, windowSec)) return tooMany(windowSec);
  return null;
}

/** Per-person limit only, for routes that do not read the request. */
export async function limitUser(userId: string, name: string, perUser: number, windowSec: number): Promise<Response | null> {
  return (await hit(`u:${name}:${userId}`, perUser, windowSec)) ? tooMany(windowSec) : null;
}
