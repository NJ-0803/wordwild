import { expect, test } from "@playwright/test";

// Signed-out callers must be refused by every account route, and webhooks must refuse anything without their secret.
const post = (url: string, data: unknown = {}) => ({ url, data });
const ROUTES: { method: "GET" | "POST" | "PUT" | "DELETE"; url: string; data?: unknown }[] = [
  { method: "GET", url: "/api/sync" }, { method: "POST", url: "/api/sync", data: { captures: [], attempts: [] } }, { method: "DELETE", url: "/api/sync" },
  { method: "GET", url: "/api/friends?day=20000" }, { method: "POST", url: "/api/friends/join", data: { code: "abcdefghjk" } }, { method: "POST", url: "/api/friends/leave", data: { pid: "abcdefgh" } },
  { method: "POST", url: "/api/play/result", data: { game: "word", day: 20000, level: "-", ms: 5000, tries: 3, won: true } },
  { method: "GET", url: "/api/telegram/link" }, { method: "POST", url: "/api/telegram/link" }, { method: "GET", url: "/api/whatsapp/link" }, { method: "POST", url: "/api/whatsapp/link" },
];
for (const r of ROUTES) {
  test(`signed out: ${r.method} ${r.url.split("?")[0]} is refused`, async ({ request }) => {
    const res = await request.fetch(r.url, { method: r.method, data: r.data, headers: { "content-type": "application/json" } });
    expect([401, 403, 503]).toContain(res.status());
  });
}
test("webhooks and the cron job refuse callers without the secret", async ({ request }) => {
  for (const [m, u] of [["POST", "/api/telegram"], ["POST", "/api/whatsapp"], ["GET", "/api/cron/daily"]] as const) {
    const res = await request.fetch(u, { method: m, data: m === "POST" ? { update_id: 1 } : undefined });
    expect([401, 403, 404, 405, 503], `${m} ${u} -> ${res.status()}`).toContain(res.status());
  }
});
test("security headers are sent", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["x-content-type-options"]).toBe("nosniff"); expect(h["x-frame-options"]).toBe("DENY"); expect(h["referrer-policy"]).toBeTruthy();
  expect(h["content-security-policy"] ?? h["content-security-policy-report-only"]).toContain("frame-ancestors 'none'");
});
test("the site works under the content security policy: no violations on the main pages", async ({ page }) => {
  const bad: string[] = [];
  page.on("console", m => { if (/Content Security Policy|violates the following/i.test(m.text())) bad.push(m.text().slice(0, 200)); });
  await page.addInitScript(() => localStorage.setItem("wordwild.onboarded", "1"));
  for (const u of ["/", "/sign-in", "/notebook", "/play", "/scan", "/settings", "/town"]) { await page.goto(u); await page.waitForTimeout(u === "/town" ? 8000 : 2500); }
  expect(bad, bad.join("\n")).toEqual([]);
});
void post;
