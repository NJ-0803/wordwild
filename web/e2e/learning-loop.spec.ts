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
