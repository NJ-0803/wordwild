# WordWild transformation plan (2026-09-26)

Source: `WordWild_Product_Transformation_Brief_for_Claude_Code.docx`. Roles taken: product analyst, UX director, technical architect, product manager.

**Position.** *The app that turns every new word you encounter into a word you actually remember.* Dictionary data is a commodity (we use WordNet and say so). The advantage is memory, personal growth, AI help, a game layer and a habit that is kind to people.

## 1. Where we are against the brief

| Brief gap | Status | What exists now |
|---|---|---|
| 1. Dictionary instead of learning companion | **Built** | Word page: meaning (simple and full), Hindi help, difficulty, pronunciation, examples, **Word Coach** (examples for interview / college essay / everyday talk / story, memory trick, look-alike words, when not to use it), **Go deeper** (tone, mild-to-strong ladder, "only this word fits"), **Constellation** (5-6 related words chosen for the learner) |
| 2. Missing retention loop | **Built (reinterpreted, see section 3)** | Daily Word Journey (meet, practise, use), learning days, milestones, daily orders (challenges), welcome-back gift, WhatsApp/Telegram daily word (needs your credentials), town that grows |
| 3. No personal vocabulary memory | **Built** | **My Word Vault**: Ready to review / New / Learning / Mastered / Waiting for a meaning, revision schedule for the next 7 days, synced to the account |
| 4. No AI differentiation | **Built** | Coach adapts examples to four situations; Constellation adapts to reading comfort; voice, scan and extension capture from real life |
| 5. Missing social / game layer | **Partly built, partly declined on purpose** | Levels and a town game, daily challenges, shareable image cards, public word pages to send to a friend. Friend comparison, leaderboards and battles: see section 3 |

Phases in the brief: Phase 1 (premium word cards, profiles, save, daily word, better search) **done**. Phase 2 (AI coach, revision engine, personalisation, scoring) **done**, scoring is deliberately "words you own" (secure), not a made-up number. Phase 3 (challenges, leaderboards, shareable cards) **challenges and cards done; leaderboards declined as specified**.

## 2. Recommendations, in the format the brief asked for

### R1. Word Coach on every word page
- **User problem:** A definition does not tell you how to use a word in the situations you care about, so you do not remember it or dare to use it.
- **Proposed solution:** One checked example for each of four situations, a memory trick, look-alike words with their real dictionary meanings, and cases to avoid.
- **Technical approach:** `core/coach.ts` (checks) + `/api/coach` + `ww_coach` cache. AI drafts (gpt-oss-120b, strict JSON); nothing is shown unless deterministic checks pass and a second blind model confirms each example's meaning and part of speech and each "avoid" statement; look-alike words must exist in the dictionary and their meaning is the dictionary's. One repair try, one fresh try. Cached forever and shared. Background batch (`npm run coach:batch`) pre-generates ~270 core words so visitors see content without signing in.
- **Priority:** P0 (done). **Retention impact:** High. It is the reason to open a word page instead of Google, and the "use it in an interview" framing turns saving into intent.

### R2. Daily Word Journey
- **Problem:** Lookups end the session; there is no reason to come back tomorrow.
- **Solution:** Today card with one word and three steps (meet, practise, use it in your own words), progress read from real events, plus a week view of learning days.
- **Technical approach:** `core/journey.ts`, derived from events, so it syncs and cannot desync; the word is anchored to the first word you touch that day so it does not change under you.
- **Priority:** P0 (done). **Retention impact:** High for D1 to D7 return.

### R3. My Word Vault and revision schedule
- **Problem:** Saved words disappear into a list; people cannot see what to do next.
- **Solution:** Every word in exactly one group, a bar chart of what is due each day this week, "you own" count.
- **Technical approach:** `vault()` in core, spaced review intervals 1/3/7/21/60 days already in the engine. Ripe words never disappear or "wilt".
- **Priority:** P0 (done). **Retention impact:** High. Spaced review is what turns saving into remembering.

### R4. Retention that does not shame (the brief's "streaks")
- **Problem:** Duolingo-style streaks raise short-term retention but punish missed days; our learners are adults with low literacy, irregular time and often shame around school.
- **Solution:** **Learning days**: a total that only goes up, a week of dots (filled or empty, never red), "N in a row" shown only from 2 upward, and only counting up to yesterday so an unfinished day never counts against you. A gift when you come back after a break.
- **Technical approach:** derived from events; no stored streak to break.
- **Priority:** P0 (done). **Retention impact:** Medium to high; we keep most of the habit signal and remove the churn from losing a streak.

### R5. Milestones and vocabulary "score"
- **Problem:** No sense of progress or identity ("I am someone who learns words").
- **Solution:** 16 milestones that stay reached; the score is **words you own** (secure), not an invented number.
- **Technical approach:** `milestones()` in core.
- **Priority:** P1 (done). **Retention impact:** Medium.

### R6. Shareable cards and public word pages
- **Problem:** No growth loop; words are learned alone.
- **Solution:** Share "my words" or one word as an image; every word has a public page (`/word/<word>`) with the meaning, coach examples if checked, and one button to save it.
- **Technical approach:** canvas image in the browser (nothing uploaded); server-rendered page, cached a day; sitemap lists only words that have checked extra content, to avoid thin pages.
- **Priority:** P1 (done, card not yet seen on screen, see risks). **Retention impact:** Medium; acquisition impact potentially high over time through search.

### R7. Better search and a meaning agent that does not fail quietly
- **Problem:** Everyday inputs failed: went, mice, recieve, "serendipity.", "Gave Up".
- **Solution and approach:** see `docs/LOOKUP-FAILURES.md` (14 failures found and fixed; the audit script stays in the repo).
- **Priority:** P0 (done). **Retention impact:** Medium. A failed first lookup is the most expensive moment in the funnel.

### R8. Social layer, done kindly (NOT built yet)
- **Problem:** Some learners are motivated by friends; but public ranking pushes low performers out, and this audience is exactly the one that leaves when they feel behind.
- **Proposed solution, in order:** (1) opt-in **friend circle**, invite by link; (2) **cooperative weekly goal** for the circle ("together: 50 words secure"), shown as a shared bar; (3) **word gifts**: send a friend a word card that opens the public word page; (4) private "compare" that shows only what each person chose to show, no ranking, no public leaderboard; (5) **battles** as a friendly 5-question round on words both people know, no winner banner for a low score.
- **Technical approach:** tables `ww_friends`, `ww_circle_goals` (grow-only events, same sync pattern), consent screen, block/leave at any time, minors excluded by not asking age. Needs a privacy review before launch.
- **Priority:** P2. **Retention impact:** Potentially high for a subset, risky for the rest; hence opt-in and cooperative first.

### R9. Measure what matters
- **Problem:** We cannot yet see whether any of this works.
- **Solution:** privacy-respecting counters: return on D1/D7/D30, words secure after 30 days (the success metric from the strategy), journey completion rate, share rate, lookup failure rate by kind. No page-level tracking, no third-party scripts.
- **Technical approach:** an events table with a random per-device id, no name or email, deletable with the account.
- **Priority:** **P1, and the next thing to do**, because every other priority above is a guess without it.

## 3. Where we deliberately did not follow the brief, and why
- **"Vocabulary streaks"** built as learning days (R4): same habit signal, no loss.
- **"Leaderboards", "friend comparison", "vocabulary battles"** not built as written (R8). They are the mechanics most likely to make an adult learner with little schooling feel behind, and the product's promise is respect. The alternatives keep the social motivation.
- **"Vocabulary scoring"** is "words you own". An exam-style score would need calibrated data we do not have, and a made-up score would mislead.

## 4. QA cases from the brief (`cd web && npm run qa:brief -- --live`)
| Case | Expected | Result 2026-09-26 |
|---|---|---|
| Search `serendipity` | definition, pronunciation, examples, save, related words | Pass for definition, pronunciation, save. The raw dictionary has 0 examples and 0 related words for this word, so examples and related words come from the Coach and Constellation, which need sign-in unless pre-generated. The background batch closes this gap for ~270 words. |
| `SERENDIPITY` | same result | Pass |
| `  serendipity` | spaces cleaned | Pass |
| `asdfghjkl` | friendly no-result | Pass: nothing invented, kept as a word waiting for a meaning |
| `cool` (ambiguous) | ask which meaning | Pass: 8 meanings offered, none chosen for the learner |
| `ubiquitous` sentence | natural, not repetitive | Pass: checked for different openings and low overlap, meaning confirmed by a second model |
| Search speed under 300 ms | | Pass: server time median 9 ms, p95 68 ms over 24 uncached words on the deployed site (database and functions are both in US East; your distance adds network time) |
| AI response under 3 s | | Pass: 1.8 to 2.4 s in live runs. Free-tier rate limits can add time; a paid plan removes that. |

## 5. Risks
- AI content is unreviewed by an editor (labelled everywhere). Needs a reviewer before a large public launch.
- The share card and word-page rendering were checked in code and by build, but the card image was not looked at on screen (the browser connection dropped).
- Groq free-tier limits will not carry thousands of users; move to a paid plan before launch.
- Clerk is on development keys.
- Beam and orb motion is unchecked on slow devices (website only; phones are not a target).
