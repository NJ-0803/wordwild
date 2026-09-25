# Wordwild browser extension (development build)

Select a word on any page and press a key: the meaning appears next to it, in simple words, with Hindi help and a Listen button.
Only the selected word is sent to your Wordwild server. Never the page, its address, or anything else.

## Install (Chrome, Edge, Brave)
1. Start Wordwild (`cd web && npm run dev -- -p 3100`).
2. Open `chrome://extensions`, switch on **Developer mode** (top right).
3. Click **Load unpacked** and choose this `extension` folder.
4. Open any web page, select a word (double-click it), and press any letter key.

## Settings
Click the extension icon, then **Settings**: choose the trigger key (any letter / D / off) and the Wordwild address.

## Tests
`node --test extension/test/*.test.js` (pure logic) and `node extension/test/live-lookup.mjs` (real API).
