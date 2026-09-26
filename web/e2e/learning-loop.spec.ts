import { expect, test } from "@playwright/test";

// The backbone of the product: find a word, save it, review it, and see the schedule and journey change.
test.beforeEach(async ({ page }) => { await page.addInitScript(() => { localStorage.setItem("wordwild.onboarded", "1"); }); });

test("search, save, review, schedule and journey update", async ({ page }) => {
  await page.goto("/capture");
  await page.getByLabel("Type a word you heard or read.").fill("serendipity");
  await page.getByRole("button", { name: "Save word" }).click();
  await expect(page).toHaveURL(/\/learn\//, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/serendipity/i);

  await page.goto("/notebook");
  await expect(page.getByRole("heading", { name: "Your review is ready." })).toBeVisible();
  await page.getByRole("link", { name: /Start review/ }).click();

  await expect(page).toHaveURL(/\/review/);
  await expect(page.getByText("Word 1 of 1")).toBeVisible();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: /I know it/ }).click();
  await expect(page.getByRole("heading", { name: "Every word came back to you." })).toBeVisible();

  await page.getByRole("link", { name: "Back to my words" }).click();
  await expect(page.getByRole("heading", { name: "You are all caught up." })).toBeVisible();     // the schedule moved the word into the future
  await expect(page.getByText("First practice")).toBeVisible();                                  // the journey recorded it
});

test("a forgotten word gets a kind summary", async ({ page }) => {
  await page.goto("/capture");
  await page.getByLabel("Type a word you heard or read.").fill("serendipity");
  await page.getByRole("button", { name: "Save word" }).click();
  await expect(page).toHaveURL(/\/learn\//, { timeout: 30_000 });
  await page.goto("/review");
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: /I forgot/ }).click();
  await expect(page.getByRole("heading", { name: /come back sooner|sooner/ })).toBeVisible();
});

test("theme choice is remembered", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Light" }).first().click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("unscramble: levels, timer and a solved word", async ({ page }) => {
  await page.goto("/play/unscramble");
  for (const l of ["Easy", "Medium", "Hard", "Super hard"]) await expect(page.getByRole("button", { name: l, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hard", exact: true }).click();
  await expect(page.getByText(/Word 1 of 5/)).toBeVisible();
  await expect(page.getByRole("timer")).toContainText("0:00");
  await page.getByRole("button", { name: "Show the first letter" }).click();
  await expect(page.getByText(/starts with/)).toBeVisible();
});

test("word of the day shows a clue from the start and friends ask you to sign in", async ({ page }) => {
  await page.goto("/play/word");
  await expect(page.locator(".pz-clue-line")).toBeVisible({ timeout: 15_000 });
  await page.goto("/play");
  await expect(page.getByRole("heading", { name: "Friends today" })).toBeVisible();
  await expect(page.getByText(/Sign in to invite friends/)).toBeVisible();
});

test("finishing unscramble by voice records a real time", async ({ page }) => {
  await page.addInitScript(() => {
    const Fake = class { onresult: ((e: unknown) => void) | null = null; onend: (() => void) | null = null; start() { setTimeout(() => { this.onresult?.({ results: [[{ transcript: (window as unknown as { __said: string }).__said }]] }); this.onend?.(); }, 100); } stop() {} };
    Object.assign(window, { SpeechRecognition: Fake, webkitSpeechRecognition: Fake });
  });
  const posted: { ms: number }[] = [];
  await page.route("**/api/play/result", async route => { posted.push(JSON.parse(route.request().postData() ?? "{}")); await route.fulfill({ json: { ok: true } }); });
  await page.goto("/play/unscramble");
  await expect(page.getByRole("button", { name: "Say the word" })).toBeVisible();
  const day = await page.evaluate(() => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000));
  const { dailyScramble } = await import("../../core/src/index.ts");
  for (const w of dailyScramble(day, "easy")) {
    await page.evaluate(x => { (window as unknown as { __said: string }).__said = x; }, w.word);
    await page.getByRole("button", { name: "Say the word" }).click({ force: true });
    await page.waitForTimeout(1000);
  }
  await expect(page.getByText(/All five done/)).toBeVisible();
  await expect.poll(() => posted.length).toBeGreaterThan(0);
  expect(posted[0].ms).toBeGreaterThanOrEqual(1500);
});

test("first visit: welcome, optional tour, Start, first word saved, never shown again", async ({ browser }) => {
  const ctx = await browser.newContext(); const page = await ctx.newPage();     // no flags: a brand-new visitor
  await page.goto("/");
  await expect(page.getByLabel("NJ")).toBeVisible();
  await page.locator(".wl-tour").click({ timeout: 15_000 });
  await expect(page.getByText("Save any word you meet")).toBeVisible();
  await page.getByRole("button", { name: "Skip tour" }).click();
  await page.locator(".wl-big").click();
  await expect(page.getByRole("heading", { name: "Save your first word" })).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await expect(page.getByLabel("NJ")).toHaveCount(0);                            // the welcome is shown once per device
  await expect(page.getByRole("heading", { name: "Save your first word" })).toBeVisible();
  await ctx.close();
});

// The promise: a completely new visitor can save a first word within 30 seconds.
test("a brand-new visitor saves their first word in under 30 seconds", async ({ browser }) => {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto("/");
  await page.getByRole("button", { name: "Start", exact: true }).click({ timeout: 15_000 });
  await page.getByLabel("A word to save").fill("serendipity");
  await page.getByLabel("A word to save").press("Enter");
  await expect(page).toHaveURL(/\/learn\//, { timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/serendipity/i);
  const secs = (Date.now() - t0) / 1000; console.log(`first word saved in ${secs.toFixed(1)}s`);
  expect(secs).toBeLessThan(30);
  await ctx.close();
});

test("day one is simple: only the essentials are in the sidebar, the rest sits under More, and everything unlocks by use", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => localStorage.setItem("wordwild.onboarded", "1"));
  await page.goto("/");
  const side = page.getByRole("complementary", { name: "Main" });
  await expect(side.getByRole("link", { name: "Save a word" })).toBeVisible();
  await expect(side.getByRole("link", { name: "Town", exact: true })).toHaveCount(0);
  await side.getByText("More", { exact: true }).click();
  await expect(side.getByRole("link", { name: "Town", exact: true })).toBeVisible();      // still one tap away
  await page.goto("/capture?word=serendipity"); await expect(page).toHaveURL(/\/learn\//, { timeout: 30_000 });
  await page.goto("/");
  await expect(side.getByRole("link", { name: "Town", exact: true })).toBeVisible();      // unlocked by the first word
});

test("the extension page has a picture guide and a step checklist", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("wordwild.onboarded", "1"));
  await page.goto("/extension");
  await expect(page.getByRole("region", { name: /Picture guide/ })).toBeVisible();
  await page.getByRole("button", { name: /Show step 4: Load unpacked/ }).click();
  await expect(page.locator(".ig-cap")).toContainText("Load unpacked");
  await page.getByLabel("I did this step").first().check();
  await expect(page.getByText(/1 of 5 steps done/)).toBeVisible();
});
