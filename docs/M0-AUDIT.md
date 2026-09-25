# Wordwild — Milestone 0: audit and decisions (2026-09-25)

Source: `source-original/` (extracted from Desktop/Wordwild-Source.zip, untouched). Blender deliverables copied to `blender-deliverables/` (reference only, not accepted art).

## 1. Inventory (30 files, ~73 KB of app code)
| Area | State | Verified today |
|---|---|---|
| `shared/engine.cjs` (27 lines) | XP, capture, review, restore | `npm test`: 9/9 pass (Node 26.9) |
| `shared/words.json` | 12 entries keyed by bare word | schema check via `npm run build` not re-run |
| `server/server.cjs` | dependency-free dev API, provider adapter unconfigured | API tests pass |
| `prototype.template.html` -> `Wordwild-Play.html` | playable browser concept | browser smoke NOT re-run (Playwright not installed) |
| `mobile/` (App.js + copy of engine) | RN source, emoji world, never built | not built |
| `unreal/` | C++ prototype | not compiled; no Unreal installed |
| `blender/` + `blender-deliverables/` | primitive island, Lumi, 4 plants | Blender.app present; not re-run |

Toolchain here: Node 26, Blender.app, adb + openjdk. **No Xcode (only Command Line Tools), no Unreal, no Playwright browsers.** iOS device builds are impossible on this machine until Xcode is installed; Android depends on an SDK I have not confirmed.

## 2. Gaps against the brief
1. **No sense identity.** Words are keyed by bare string; one lemma = one meaning. Brief section 4 needs stable sense IDs, so this is a data-model rewrite, not a patch.
2. **Mastery is one integer (`stage` 0-4).** Brief section 6 needs separate evidence per skill (listening, reading, meaning, recall, usage/register), hint use, and recorded recommendation reasons. Reviews only reward correct-when-due; wrong answers do not record which mistake type.
3. **Content lacks fields:** register, collocations, related forms, translation, pronunciation/audio, prerequisites, review status, licence. Examples per word are 2-3 (brief wants >=3 in distinct contexts). `provenance` is free text.
4. **Practice is multiple choice only.** Brief section 8 wants varied templates.
5. **No idempotency keys, sync, or schema migration** beyond "reset on corrupt".
6. **Accessibility:** no spoken onboarding, audio-first path, screen-reader testing, or non-text UI. This is the core product path per section 9, and it is absent.
7. **Three parallel clients** (HTML, RN, Unreal) share only a data file. Brief warns against this.
8. **Art** is rejected by the user as too basic; nothing to integrate.

## 3. Reuse decision
- Keep as ideas/tests: capture validation, duplicate guard, reward-only-when-due, corrupt-save recovery, the 9 test cases (port them to the new model).
- Keep as fixtures: the 12 entries (after upgrade to the new schema; provenance stays "original, unreviewed").
- Retire: Unreal prototype, Wordwild-Play.html as a product (keep as historical concept), island-only world.
- Lumi and plants: optional supporting characters only if they fit the new art direction.

## 4. Architecture recommendation (needs your confirmation)
**Option 1: mobile-first app with an integrated lightweight 2D/2.5D story renderer.**
- Expo (React Native) + TypeScript, one client. Story scenes as layered 2D illustration with skeletal/vector animation (Rive or Lottie) plus Reanimated; reduced-motion swaps to static poses.
- Learning core as a pure TypeScript package (schema, learner model, scheduler, activity templates) with unit tests, shared by client and backend.
- Backend: small Node/TypeScript service + Postgres (later; Milestone 1 runs fully local with fixtures). Provider interfaces for dictionary, TTS and AI, all unconfigured by default.
- Why not Unreal: no measured evidence it is needed, heavy for low-end phones and screen-reader support, and RN-Unreal embedding is unproven. Revisit only after a measured spike.
- 3D (Blender GLBs) is dropped from the critical path; 2D gives better polish per effort and is friendlier to reduced motion and low-end Android.

## 5. Reversible assumptions (used until you decide)
- Teach **English**, explain in **Hindi/Punjabi** (Latin/Devanagari/Gurmukhi text + audio), matching the brief's own examples.
- First learner: **adult, low-literacy, audio-first**, since that is the hardest path and shapes everything else.
- **Android first** (this machine cannot build iOS).
- No accounts in Milestone 1; local storage only, sync designed but not built.
- Fixture dictionary content, clearly labelled "unverified fixture".

## 6. Backlog (dependency order)
1. Repo scaffold: TS monorepo (`core/`, `app/`, `server/`), test runner, CI script.
2. `core` schema: Word, Sense (stable ID, version), Attempt/Event with idempotency key, per-skill evidence, review schedule, recommendation+reason, reward ledger. Versioned save with migration.
3. Fixture pack: euphemism + tactful/indirect/understatement + prerequisites (`polite`, `harsh`, `hint`), in the new schema, honest provenance.
4. Scheduler + explainable recommender with unit tests (duplicates, retries, clock skew, reward caps).
5. Activity templates: Meaning Bridge, Conversation Choice, Listen and Find, Word Connections, Explain It Back (uncertainty-aware). Answer-position shuffling and validation of question data.
6. App shell: audio-first onboarding, capture, sense picker/pending state, explanation with replay/"simpler"/"show me", practice, notebook, settings (text scale, reduced motion). Offline persistence.
7. Story slice (one chapter) after the visual target is approved.
8. Android build + on-device checks; then learner sessions.

## 7. Questions that change what I build next
1. Confirm the assumptions in section 5 (language pair, first learner, Android-first), or correct them.
2. OK to go with Option 1 (Expo + 2D story renderer, drop Unreal)?
3. Which story chapter for the vertical slice? I suggest "15-20: Finding your voice" or "20-35: Making your way", because euphemism/tact fits adult scenarios (a job loss, a hard conversation) and avoids the infantilizing childhood start.
4. Dictionary source: none is licensed yet. Milestone 1 uses fixtures; do you have a provider in mind (e.g. a licensed API), or should I list options with licence terms?
