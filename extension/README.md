# Wordwild browser extension (development build)

Select a word on any page and press a key: the meaning appears next to it, in simple words, with Hindi help and a Listen button.
Only the selected word is sent to your Wordwild server. Never the page, its address, or anything else.

## Install (Chrome, Edge, Brave)
1. Wordwild is at https://wordwild-seven.vercel.app (the extension's default address). For local work, start it with `cd web && npm run dev -- -p 3100` and set that address in Settings.
2. Open `chrome://extensions`, switch on **Developer mode** (top right).
3. Click **Load unpacked** and choose this `extension` folder.
4. Open any web page, select a word (double-click it), and press any letter key.

## Settings
Click the extension icon, then **Settings**: choose the trigger key (any letter / D / off) and the Wordwild address.

## Tests
`node --test extension/test/*.test.js` (pure logic) and `node extension/test/live-lookup.mjs` (real API).

## Look
Black and navy like the website: serif word, mono labels, a beam around the card and fields, a glowing CSS orb (the website uses the thinking-orbs library, which a content script cannot load). Motion stops under reduced-motion. `test/preview.html` shows the in-page card with stubbed browser APIs (`python3 -m http.server` in `extension/`).
