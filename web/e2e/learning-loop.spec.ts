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

test("first visit: welcome, tour, Start, choose a language, land on Today", async ({ browser }) => {
  const ctx = await browser.newContext(); const page = await ctx.newPage();     // no flags: a brand-new visitor
  await page.goto("/");
  await expect(page.getByLabel("NJ")).toBeVisible();
  await page.getByRole("button", { name: /Take the tour/ }).click({ timeout: 15_000 });
  await expect(page.getByText("Save any word you meet")).toBeVisible();
  await page.getByRole("button", { name: "Skip tour" }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Choose your language" })).toBeVisible();
  await page.getByRole("button", { name: /English/ }).dispatchEvent("click");           // the boxes float, so a synthetic click is steadier than a pointer
  await page.locator(".ob-go").dispatchEvent("click");
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible({ timeout: 10_000 });
  await page.reload();                                                       // never shown again on this device
  await expect(page.getByLabel("NJ")).toHaveCount(0);
  await ctx.close();
});
