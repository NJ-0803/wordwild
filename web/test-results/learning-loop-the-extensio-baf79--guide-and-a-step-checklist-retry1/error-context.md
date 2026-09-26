# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: learning-loop.spec.ts >> the extension page has a picture guide and a step checklist
- Location: e2e/learning-loop.spec.ts:130:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/Click Load unpacked/)
Expected: visible
Error: strict mode violation: getByText(/Click Load unpacked/) resolved to 2 elements:
    1) <p role="status" class="ig-cap">…</p> aka getByText('4. Click Load unpacked,')
    2) <p class="sub">…</p> aka getByText('Three buttons appear at the')

Call log:
  - Expect "toBeVisible" getByText(/Click Load unpacked/) with timeout 5000ms
  - waiting for getByText(/Click Load unpacked/)

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - complementary "Main" [ref=e3]:
      - link "Wordwild home" [ref=e4] [cursor=pointer]:
        - /url: /
        - img "Wordwild" [ref=e9]
        - generic [ref=e10]: Wordwild
      - navigation [ref=e11]:
        - link "Today" [ref=e12] [cursor=pointer]:
          - /url: /
        - link "My words" [ref=e16] [cursor=pointer]:
          - /url: /notebook
        - link "Save a word" [ref=e19] [cursor=pointer]:
          - /url: /capture
        - link "Settings" [ref=e22] [cursor=pointer]:
          - /url: /settings
        - group [ref=e26]:
          - generic "More" [ref=e27] [cursor=pointer]
      - group "Colour theme" [ref=e29]:
        - button "Dark" [pressed] [ref=e30] [cursor=pointer]
        - button "Light" [ref=e33] [cursor=pointer]
      - paragraph [ref=e37]:
        - link "Credits" [ref=e38] [cursor=pointer]:
          - /url: /about
        - text: ·
        - link "Privacy" [ref=e39] [cursor=pointer]:
          - /url: /privacy
    - main [ref=e40]:
      - generic [ref=e41]:
        - generic [ref=e42]:
          - img "Wordwild extension" [ref=e47]
          - generic [ref=e48]:
            - heading "Add Wordwild to Chrome" [level=1] [ref=e49]
            - paragraph [ref=e50]: Select a word on any website, press a key, see the meaning next to it. Free. Takes about two minutes.
        - progressbar "Steps done" [ref=e51]
        - paragraph [ref=e52]: 0 of 5 steps done. We will tell you here when the extension is working.
        - 'region "Picture guide: how to add the extension" [ref=e53]':
          - 'img "Step 4: Click Load unpacked, choose the folder, press Select." [ref=e54]':
            - emphasis [ref=e59]: chrome://extensions
            - generic [ref=e61]:
              - generic [ref=e62]:
                - generic [ref=e63]: Load unpacked
                - generic [ref=e64]: Pack extension
                - generic [ref=e65]: Update
              - generic [ref=e66]:
                - generic [ref=e67]: ▤ Documents
                - generic [ref=e68]: ▤ wordwild-extension
                - generic [ref=e69]: Select
          - status [ref=e70]: 4. Click Load unpacked, choose the folder, press Select.
          - generic [ref=e71]:
            - 'button "Show step 1: Download and unzip" [ref=e72] [cursor=pointer]': "1"
            - 'button "Show step 2: Open the extensions page" [ref=e73] [cursor=pointer]': "2"
            - 'button "Show step 3: Turn on Developer mode" [ref=e74] [cursor=pointer]': "3"
            - 'button "Show step 4: Load unpacked" [active] [ref=e75] [cursor=pointer]': "4"
            - 'button "Show step 5: Try it" [ref=e76] [cursor=pointer]': "5"
            - button "Play" [ref=e77] [cursor=pointer]
        - generic [ref=e80]:
          - generic [aria-hidden] [ref=e81]: "1"
          - generic [ref=e82]:
            - heading "Download and unzip" [level=2] [ref=e83]
            - generic [ref=e84]:
              - paragraph [ref=e85]: "Download the file, then open your Downloads folder and double-click it. A folder called wordwild-extension appears. Keep that folder somewhere you will not delete it, for example Documents: Chrome reads the extension from it."
              - link "Download the extension (35 KB)" [ref=e87] [cursor=pointer]:
                - /url: /wordwild-extension.zip
            - generic [ref=e88] [cursor=pointer]:
              - checkbox "I did this step" [ref=e89]
              - text: I did this step
        - generic [ref=e92]:
          - generic [aria-hidden] [ref=e93]: "2"
          - generic [ref=e94]:
            - heading "Open Chrome's extensions page" [level=2] [ref=e95]
            - generic [ref=e96]:
              - paragraph [ref=e97]: Websites are not allowed to open this page for you. Open a new tab, paste the address below, and press Enter.
              - generic [ref=e98]:
                - code [ref=e99]: chrome://extensions
                - button "Copy" [ref=e102] [cursor=pointer]
              - paragraph [ref=e103]:
                - text: On Edge use
                - code [ref=e104]: edge://extensions
                - text: ", on Brave"
                - code [ref=e105]: brave://extensions
                - text: .
            - generic [ref=e106] [cursor=pointer]:
              - checkbox "I did this step" [ref=e107]
              - text: I did this step
        - generic [ref=e110]:
          - generic [aria-hidden] [ref=e111]: "3"
          - generic [ref=e112]:
            - heading "Turn on Developer mode" [level=2] [ref=e113]
            - paragraph [ref=e115]: Find the switch called Developer mode at the top right of that page and turn it on. It stays on. This is what lets Chrome load an extension that is not from the store.
            - generic [ref=e116] [cursor=pointer]:
              - checkbox "I did this step" [ref=e117]
              - text: I did this step
        - generic [ref=e120]:
          - generic [aria-hidden] [ref=e121]: "4"
          - generic [ref=e122]:
            - heading "Click “Load unpacked” and choose the folder" [level=2] [ref=e123]
            - paragraph [ref=e125]: "Three buttons appear at the top left. Click Load unpacked, then pick the wordwild-extension folder from step 1 (the folder that contains a file called manifest.json) and press Select. Grey file names in the picker are normal: you are choosing a folder, not a file."
            - generic [ref=e126] [cursor=pointer]:
              - checkbox "I did this step" [ref=e127]
              - text: I did this step
        - generic [ref=e130]:
          - generic [aria-hidden] [ref=e131]: "5"
          - generic [ref=e132]:
            - heading "Try it" [level=2] [ref=e133]
            - generic [ref=e134]:
              - paragraph [ref=e135]: Open any article and refresh it (pages that were already open do not have the extension yet). Double-click a word, then press any letter key. A card with the meaning appears next to the word. Click the puzzle-piece icon in Chrome’s toolbar and pin Wordwild to keep it handy.
              - paragraph [ref=e136]: Nothing happens inside a text box on purpose, so it never gets in the way of typing.
            - generic [ref=e137] [cursor=pointer]:
              - checkbox "I did this step" [ref=e138]
              - text: I did this step
        - generic [ref=e140]:
          - heading "If something goes wrong" [level=2] [ref=e141]
          - list [ref=e142]:
            - listitem [ref=e143]: Nothing appears. Refresh the page you are reading, then select the word again and press a letter key.
            - listitem [ref=e144]: “Extension context invalidated”. This appears after Chrome reloads the extension. Refresh the page.
            - listitem [ref=e145]: "Chrome says the extension is unsafe or from an unknown source. That is Chrome’s standard message for any extension loaded this way. The extension is open to read: it only asks to reach wordwild-seven.vercel.app."
            - listitem [ref=e146]: Chrome asks whether to keep developer-mode extensions when it starts. Choose to keep them.
            - listitem [ref=e147]: To update, download the file again, replace the folder, then press the round reload arrow on Wordwild in the extensions page.
        - generic [ref=e149]:
          - heading "What it does and does not do" [level=2] [ref=e150]
          - paragraph [ref=e151]:
            - text: Only the word you select is sent to Wordwild, and only when you press the key. It does not read the page, your history or anything you type. There are no ads and no tracking.
            - link "Read the privacy policy" [ref=e152] [cursor=pointer]:
              - /url: /privacy
            - text: .
        - generic [ref=e153]: Version 1.1.0 (adds Quick save)
        - link "Back" [ref=e158] [cursor=pointer]:
          - /url: /
  - alert [ref=e159]
```

# Test source

```ts
  35  |   await page.getByRole("button", { name: /I forgot/ }).click();
  36  |   await expect(page.getByRole("heading", { name: /come back sooner|sooner/ })).toBeVisible();
  37  | });
  38  | 
  39  | test("theme choice is remembered", async ({ page }) => {
  40  |   await page.goto("/settings");
  41  |   await page.getByRole("button", { name: "Light" }).first().click();
  42  |   await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  43  |   await page.reload();
  44  |   await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  45  | });
  46  | 
  47  | test("unscramble: levels, timer and a solved word", async ({ page }) => {
  48  |   await page.goto("/play/unscramble");
  49  |   for (const l of ["Easy", "Medium", "Hard", "Super hard"]) await expect(page.getByRole("button", { name: l, exact: true })).toBeVisible();
  50  |   await page.getByRole("button", { name: "Hard", exact: true }).click();
  51  |   await expect(page.getByText(/Word 1 of 5/)).toBeVisible();
  52  |   await expect(page.getByRole("timer")).toContainText("0:00");
  53  |   await page.getByRole("button", { name: "Show the first letter" }).click();
  54  |   await expect(page.getByText(/starts with/)).toBeVisible();
  55  | });
  56  | 
  57  | test("word of the day shows a clue from the start and friends ask you to sign in", async ({ page }) => {
  58  |   await page.goto("/play/word");
  59  |   await expect(page.locator(".pz-clue-line")).toBeVisible({ timeout: 15_000 });
  60  |   await page.goto("/play");
  61  |   await expect(page.getByRole("heading", { name: "Friends today" })).toBeVisible();
  62  |   await expect(page.getByText(/Sign in to invite friends/)).toBeVisible();
  63  | });
  64  | 
  65  | test("finishing unscramble by voice records a real time", async ({ page }) => {
  66  |   await page.addInitScript(() => {
  67  |     const Fake = class { onresult: ((e: unknown) => void) | null = null; onend: (() => void) | null = null; start() { setTimeout(() => { this.onresult?.({ results: [[{ transcript: (window as unknown as { __said: string }).__said }]] }); this.onend?.(); }, 100); } stop() {} };
  68  |     Object.assign(window, { SpeechRecognition: Fake, webkitSpeechRecognition: Fake });
  69  |   });
  70  |   const posted: { ms: number }[] = [];
  71  |   await page.route("**/api/play/result", async route => { posted.push(JSON.parse(route.request().postData() ?? "{}")); await route.fulfill({ json: { ok: true } }); });
  72  |   await page.goto("/play/unscramble");
  73  |   await expect(page.getByRole("button", { name: "Say the word" })).toBeVisible();
  74  |   const day = await page.evaluate(() => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000));
  75  |   const { dailyScramble } = await import("../../core/src/index.ts");
  76  |   for (const w of dailyScramble(day, "easy")) {
  77  |     await page.evaluate(x => { (window as unknown as { __said: string }).__said = x; }, w.word);
  78  |     await page.getByRole("button", { name: "Say the word" }).click({ force: true });
  79  |     await page.waitForTimeout(1000);
  80  |   }
  81  |   await expect(page.getByText(/All five done/)).toBeVisible();
  82  |   await expect.poll(() => posted.length).toBeGreaterThan(0);
  83  |   expect(posted[0].ms).toBeGreaterThanOrEqual(1500);
  84  | });
  85  | 
  86  | test("first visit: welcome, optional tour, Start, first word saved, never shown again", async ({ browser }) => {
  87  |   const ctx = await browser.newContext(); const page = await ctx.newPage();     // no flags: a brand-new visitor
  88  |   await page.goto("/");
  89  |   await expect(page.getByLabel("NJ")).toBeVisible();
  90  |   await page.locator(".wl-tour").click({ timeout: 15_000 });
  91  |   await expect(page.getByText("Save any word you meet")).toBeVisible();
  92  |   await page.getByRole("button", { name: "Skip tour" }).click();
  93  |   await page.locator(".wl-big").click();
  94  |   await expect(page.getByRole("heading", { name: "Save your first word" })).toBeVisible({ timeout: 10_000 });
  95  |   await page.reload();
  96  |   await expect(page.getByLabel("NJ")).toHaveCount(0);                            // the welcome is shown once per device
  97  |   await expect(page.getByRole("heading", { name: "Save your first word" })).toBeVisible();
  98  |   await ctx.close();
  99  | });
  100 | 
  101 | // The promise: a completely new visitor can save a first word within 30 seconds.
  102 | test("a brand-new visitor saves their first word in under 30 seconds", async ({ browser }) => {
  103 |   const ctx = await browser.newContext(); const page = await ctx.newPage();
  104 |   const t0 = Date.now();
  105 |   await page.goto("/");
  106 |   await page.getByRole("button", { name: "Start", exact: true }).click({ timeout: 15_000 });
  107 |   await page.getByLabel("A word to save").fill("serendipity");
  108 |   await page.getByLabel("A word to save").press("Enter");
  109 |   await expect(page).toHaveURL(/\/learn\//, { timeout: 20_000 });
  110 |   await expect(page.getByRole("heading", { level: 1 })).toContainText(/serendipity/i);
  111 |   const secs = (Date.now() - t0) / 1000; console.log(`first word saved in ${secs.toFixed(1)}s`);
  112 |   expect(secs).toBeLessThan(30);
  113 |   await ctx.close();
  114 | });
  115 | 
  116 | test("day one is simple: only the essentials are in the sidebar, the rest sits under More, and everything unlocks by use", async ({ page }) => {
  117 |   await page.setViewportSize({ width: 1280, height: 800 });
  118 |   await page.addInitScript(() => localStorage.setItem("wordwild.onboarded", "1"));
  119 |   await page.goto("/");
  120 |   const side = page.getByRole("complementary", { name: "Main" });
  121 |   await expect(side.getByRole("link", { name: "Save a word" })).toBeVisible();
  122 |   await expect(side.getByRole("link", { name: "Town", exact: true })).toHaveCount(0);
  123 |   await side.getByText("More", { exact: true }).click();
  124 |   await expect(side.getByRole("link", { name: "Town", exact: true })).toBeVisible();      // still one tap away
  125 |   await page.goto("/capture?word=serendipity"); await expect(page).toHaveURL(/\/learn\//, { timeout: 30_000 });
  126 |   await page.goto("/");
  127 |   await expect(side.getByRole("link", { name: "Town", exact: true })).toBeVisible();      // unlocked by the first word
  128 | });
  129 | 
  130 | test("the extension page has a picture guide and a step checklist", async ({ page }) => {
  131 |   await page.addInitScript(() => localStorage.setItem("wordwild.onboarded", "1"));
  132 |   await page.goto("/extension");
  133 |   await expect(page.getByRole("region", { name: /Picture guide/ })).toBeVisible();
  134 |   await page.getByRole("button", { name: /Show step 4: Load unpacked/ }).click();
> 135 |   await expect(page.getByText(/Click Load unpacked/)).toBeVisible();
      |                                                       ^ Error: expect(locator).toBeVisible() failed
  136 |   await page.getByLabel("I did this step").first().check();
  137 |   await expect(page.getByText(/1 of 5 steps done/)).toBeVisible();
  138 | });
  139 | 
```