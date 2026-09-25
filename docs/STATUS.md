# Wordwild — status and decision log (2026-09-25)

## How to run
```
cd web && npm run dev -- -p 3100        # app at http://localhost:3100
cd core && npm test                     # 46 tests
cd web && npm run db:test               # data layer vs real DB (throwaway users)
cd web && npm run enrich:test           # Groq client (mocked network) + enrichment DB helpers
cd web && npm run db:migrate            # create/upgrade tables (idempotent)
cd web && npm run dict:build && npm run dict:load   # rebuild dictionary from ../dictionary/raw
```
Env (`web/.env.local`, never committed): `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `DATABASE_URL`, and to switch on practice generation: `GROQ_API_KEY`.

## Update — WhatsApp channel (2026-09-26)
- **WhatsApp via Meta Cloud API** (official), alongside Telegram; decision: NOT Hermes as the public front door (a personal tool-using agent behind a public number is a prompt-injection risk, needs per-user CLI approval, runs on a laptop). Hermes stays for the owner's private assistant. Hermes' official adapter (gateway/platforms/whatsapp_cloud.py) was used as a security reference.
- Built: /api/whatsapp (GET handshake, POST signed webhook), /api/whatsapp/link, hourly cron shared with Telegram, Settings card, shared channel-independent daily chooser (web/src/lib/daily.ts), WhatsApp formatting/chunking/command parsing in core (95 tests).
- Safety: X-Hub-Signature-256 HMAC over the raw body (constant time), wamid replay protection, per-number rate limit, opt-in only by the learner messaging us (LINK code, one-time, 10 min), STOP honoured in several spellings and deletes the number, number also deleted with the account, consent time recorded, free text only inside the 24 h window, approved template outside it (or silence if none set up), once per local day.
- Verified: whatsapp:test (mocked Meta + real DB), and the live webhook over HTTP (handshake ok/403, no/bad/tampered signature 403, valid 200, unconfigured 503). NOT verified with real Meta: needs the test number setup in docs/WHATSAPP-SETUP.md.
- Cost note: business-initiated templates are charged per message; I could not verify current Meta prices (search unavailable).

## Update — Camera capture (2026-09-25, late night)
- **Scan a page** (/scan): photo or camera -> on-device OCR (Tesseract.js 7, self-hosted in web/public/ocr, English, ~13 MB, works offline, the photo is never uploaded) -> every word is a tappable box over the photo -> meaning + Hindi + save, with the sentence it appeared in stored as the private "where I saw it" note (source "Camera"). "Words worth a look" uses the cached AI difficulty predictor (/api/levels) and falls back to a labelled heuristic.
- Core helpers (core/src/ocr.ts, 4 tests): word cleaning (rejects digits/symbols), line joining with hyphen mending, sentence extraction, unfamiliar-word ranking. Core tests now 92.
- Verified in Chrome with a canvas-drawn "page": all 29 words read correctly in ~4 s including engine start; tapping a word opens its meaning; "understand" no longer flagged once AI levels are used.
- NOT verified: a real phone camera photo (capture=environment), HEIC photos, curved/blurry/low-light pages, handwriting (Tesseract is weak at handwriting), non-English text.

## Update — Town + Telegram (2026-09-25, night)
- **Wordwild Town** (Township-style, learning IS the loop): core/src/town.ts (pure, 10 tests): saved word = crop, ripe when its review is due (harvest = review), never wilts; coins/XP only from the real mastery ledger + 3 daily orders measured from real events; 8 buildings = life-journey chapters (Home, Market, School, Cafe, Workshop, Clinic, Community hall, Library); build/claim are synced grow-only events, forged ones are dropped on rebuild. Left out on purpose: barn limits, premium currency, streaks, timers that punish.
- Pacing fix found by tests: 50 XP per level so the first mastered word (55 pts) levels you up and pays for the first building.
- 3D town (web/src/components/town): CC0 Kenney models (Suburban 2.0, Commercial 2.1, Nature Kit; credits in public/town/CREDITS.txt), recoloured to a warm palette because the originals are unlit+metallic; isometric pan/zoom; ripe crops glow; HUD (level, XP, coins), orders/harvest/build sheets. Verified in Chrome: orders panel with real progress, claim (+12 coins), synced to the server.
- Note: the automation Chrome tab is `visibilityState: hidden`, so requestAnimationFrame is paused and 3D looks "slow to appear" in tests only. Real load: all 41 models arrive in ~200 ms.
- Not tested: tapping objects inside the 3D scene (raycast clicks) and dragging to pan (needs a visible tab / a person).
- **Telegram daily word + bot-as-dictionary**: core/src/daily.ts (pure, 6 tests), web/src/lib/telegram.ts, /api/telegram (webhook, secret-verified), /api/telegram/link, /api/cron/daily (hourly, CRON_SECRET), vercel.json cron, Settings card, `npm run telegram:poll` for local testing. Verified with mocked Telegram + real DB: one-time expiring link codes, word lookups, rate limit, once per learner per local day at their chosen hour, silence when nothing useful, /stop. NOT verified with the real Telegram network (no bot token yet).
- WhatsApp: needs Meta Business API approval and paid conversations; Telegram first.

## Update — feature pass (2026-09-25, evening)
Built and verified (core 72 tests + live runs + browser):
- **Word Constellation** (one word -> 5-6 words chosen for you): core/src/level.ts (polite profile + level model), core/src/constellation.ts (pure, tested selector), web/src/lib/constellation.ts (pool = WordNet relations + Groq suggestions, AI picks the intended MEANING from the dictionary's list, AI difficulty with a degenerate-output guard), /api/constellation, 3D scene (star + orbiting words, distance = difficulty for you), profile card (every question skippable; age/schooling last, never limit content; editable/forgettable in Settings).
- **Go deeper** (tone, intensity ladder, "only this word fits" with near-synonyms, each claim confirmed by a blind solver; unverified parts dropped): core/src/depth.ts, /api/depth, interactive cards.
- **Voice** (Whisper via Groq): /voice, /api/voice. Live-tested with real speech: English, Hindi+English, sentence-decides-meaning (bank), vague request, unknown word. Real microphone permission flow NOT tested (needs a human).
- **Browser extension** (extension/): select a word, press a key, meaning appears. Logic tested (3 tests) and the real background script tested against the real API. NOT loaded into Chrome by me (needs "Load unpacked").
- Enrichment pipeline hardened: 10/10 live words pass; drop-only-the-bad-question rule; transient errors never stored as verdicts; repair loop; degenerate-output guards.
- Strategy: docs/PRODUCT-STRATEGY.md (competitor gaps, retention without shame, acquisition).

## Next (in order)
1. Real-phone test of camera capture; Telegram bot token to test the bot for real.
2. Town depth: visitors with story scenes per chapter, word collections, gentle weekly events; make the town the home screen.
3. Frontend redesign (user dislikes current UI): make constellation, garden, orbs and beam the visual centre; mobile-first.
4. Editor review workflow for AI content before public launch; move off Groq free tier.

## Update — UI/3D pass (earlier 2026-09-25)
- Applied all installed libraries: thinking-orbs (listening, searching, composing, connecting, weaving, breathing = 6 of 9 states), bot-avatars (Lumi = blob; every word gets its own buddy, asleep when secure, awake/hopping when due), border-beam (secure-word rewards, reduced-motion gets a still ring), three + r3f + drei (garden, per-word mini scene), threejs skills (lighting: soft shadows/daylight; shaders: wind on grass; animation: spring pop; postprocessing skill: chose glow sprites over a bloom pass for phone performance).
- Not used: img2threejs (primitives look), EffectComposer bloom, OrbitControls (would capture touch scrolling).
- Found and fixed by testing the PRODUCTION build: Today crashed for anyone who saved a dictionary word (recommender/Today looked the word up in the curated list). Regression test added; `app/error.tsx` added so a screen crash never blanks the app. Also replaced drei `Html` labels (they threw on unmount) with in-scene sprite labels + a screen-reader text list.
- Verified in Chrome (prod build): a fresh origin signed in to the same account pulled down previously saved words (real cross-origin sync), garden renders, no console errors.
- 3D chunk is ~239 KB gzipped, lazy; skipped when Data Saver is on. Reduced motion still loads it (static render).
- Dev-only pages: /dev/garden, /dev/ui (404 in production).
- Phone-width (390 px) check of 9 routes: no horizontal overflow. Automated a11y sweep (not a screen-reader test): fixed 32 px user-menu button, 19 px credits link, missing h1 on practice; now clean. Garden zooms to fit narrow screens.
- Full loop verified in the real app (dev): practise -> "come back tomorrow" -> skip a day -> Today puts the due review first -> review in new questions -> word becomes secure (rewards 5+10+10+30, no double pay) -> beam on summary and garden card, plant in full bloom, Lumi happy. Sync was blocked during the test and local data restored; account confirmed untouched.
- Content gap: euphemism has only 5 practice items, so a later review reuses some earlier questions; new "different context" items need to be authored/generated.

## Working (verified)
- Core learning engine (schema, validators, scheduler, recommender, activities, idempotent attempts, sync merge/rebuild) — 46 tests.
- Web app: onboarding (Hindi/English), Today + 3D garden, capture with sense picker, lesson, practice, notebook, settings, credits page.
- Dictionary: 161,485 senses / 107,439 words from Open English WordNet 2025 (CC BY 4.0) + CMUdict, in Neon `ww_dict`; typed word -> senses -> lesson (verified in Chrome with "skeptical").
- Login: Clerk (Google + email), nothing locked; guests stay local. API `/api/sync` needs login (401 verified).
- Data layer verified against the real DB: idempotent writes, per-user isolation, last-write-wins prefs, delete.
- Groq enrichment pipeline: strict-schema generation (gpt-oss-120b), grounding checks, blind-solver verification (gpt-oss-20b), shared validated cache, failure memory, per-user daily quota (15). Verified with mocked network + real DB helpers.

## NOT verified / not built
- Signed-in sync end to end in a browser (needs a human login; not exercised by tests).
- Live Groq generation: **no GROQ_API_KEY yet**, so no real lesson has been generated. Hindi quality, question quality and the blind-solver's false-reject rate are unknown until it runs.
- Voice input, real audio (only browser TTS), offline lesson downloads, mobile-width and screen-reader testing, real-device performance, learner sessions.
- Content is unreviewed: WordNet meanings as published; fixtures, Hindi text and any AI drafts are labelled unreviewed.
- Story chapter, minigames beyond choice/explain, spaced-recall-after-time flow test in browser.

## Decisions
- 2026-09-25 Web app (Next.js + Clerk + Neon) replaces the Expo app (parked in `app/`). Unreal dropped. 3D everywhere (user), with prefers-reduced-motion honoured.
- Dictionary = Open English WordNet (CC BY 4.0) + CMUdict; AI only adapts explanations/practice, never replaces facts (definition, POS, synonyms, antonyms are copied, not generated).
- AI gate: nothing generated is shown unless schema + grounding + blind-solver checks all pass. Enrichment requires sign-in (cost control).
- Groq models: `openai/gpt-oss-120b` generates, `openai/gpt-oss-20b` verifies (different model so errors are less correlated). Chosen from Groq docs (strict structured outputs supported); Qwen3.8-27B is a candidate for a Hindi-quality comparison once a key exists.
- Sync = grow-only events + deterministic rebuild by the shared engine; prefs are last-write-wins.
- WordNet sense order is NOT frequency order, so the learner always chooses the sense.

## Known limits
- Full-event download on each sync (needs incremental cursor later). Rate limits are per server instance.
- Inflection matching is a heuristic (no irregular forms: went, mice stay unknown).
- Dictionary-only words have no practice until enriched.
- Neon project is shared with another app; `ww_dict` uses ~47 MB of the project's storage.

## Town story scenes (2026-09-26)
- `core/src/story.ts`: 7 short scenes, one per building except a second at Home (tea, market hint, flood at school, nervous chef, "let go" at the workshop, careful words at the clinic, disagreeing kindly at the hall, old flood at the library). Beats: say / word / choose / end. Each decision has 3 options, one best, with a kind reason and free retry. Hindi lines and the whole text are AUTHOR DRAFTS, not editor-reviewed (`STORY_STATUS`).
- Words used are curated fixtures only (polite, blunt, indirect, understatement, tactful, euphemism), so saving one gives checked practice immediately.
- New `scene` TownEvent: rewarded once (12 coins, 12 XP) and only in a built building; replay is free. Sanitizer, sync replay and DB check constraint (migration applied) updated.
- UI: building sheet lists scenes; `SceneStage` reads aloud (Listen buttons, autoplay if audio-first), shows Hindi when chosen, saves words to the garden.
- Checks: core 101, db:test, lint 0, build ok, real browser play-through (poor choice, retry, best, finish, reward, event stored).
- Not done: editor review of story text, more scenes per building, weekly events/collections, town as home screen, frontend redesign.

## Economy pass (2026-09-26)
See docs/ECONOMY.md. Levels now rise on a curve (50,60,70...) and never fall; daily cap on discovery coins (8 words); welcome-back gift (15 after 3+ days away, no penalty); HUD shows points to next level; Today has a "Your town" card. Core tests 105, db:test, lint, tsc green.
Not built: weekly events, chapter collections, town as full home screen (redesign phase).

## Deploy (2026-09-26)
GitHub: NJ-0803/wordwild (private). Vercel project `wordwild`, root directory `web`, source files outside root enabled (core is imported via @core). Hobby plan allows only daily crons, so /api/cron/daily runs once a day at 02:30 UTC (08:00 IST): daily messages only reach learners whose chosen hour matches that run. Hourly needs Vercel Pro or an external hourly pinger sending `Authorization: Bearer $CRON_SECRET`.
Production env set: DATABASE_URL, GROQ_API_KEY, Clerk keys. Not set: Telegram/WhatsApp/CRON_SECRET/APP_URL (channels off until you add them).

## Public (2026-09-26)
Deployment Protection off; site is public at https://wordwild-seven.vercel.app. Learner data is local per origin unless signed in (Clerk dev keys; production Clerk instance still to do).

## UI redesign pass 1 (2026-09-26)
Black (~85%) + dark navy (~15%), dark only. Type from the Bhookmark brief (Instrument Serif headline, Inter Tight headings, Inter body, IBM Plex Mono labels; self-hosted via next/font; weight <= 600). Motion from the same brief (tap compress + ripple, spring open with overshoot, background recedes to .96, sheen; only under prefers-reduced-motion: no-preference). Border beam is always on for cards, buttons, search/text fields (component `Beam`, `Field`), CSS beam on order cards, HUD and dock. Large always-visible orb (`Orb`, `SpeakingOrb`) on Today, capture, notebook, settings, scenes, town HUD. Skills used: premium-web-design, epic-design (from alirezarezvani/claude-skills, guidance only), bhookmark-ui (type + motion only). `motion` package installed but not yet used in components.
Not verified visually: 3D town/garden under the new palette (automation tab is hidden so WebGL does not draw); real-device performance of many beams.
