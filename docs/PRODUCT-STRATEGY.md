# Wordwild — product strategy (2026-09-25)

## The story in one sentence
**You look up one word. You leave with six.** Every lookup opens a small constellation of related words chosen for *you*, and your words grow into a garden/story you want to come back to.

## What exists today (research, Sept 2026)
| Type | Examples | What they do well | Where they stop |
|---|---|---|---|
| Dictionaries | Merriam-Webster, Oxford, Cambridge, Dictionary.com | Trusted definitions, audio, examples, thesaurus, word of the day | Same page for everyone; assume you can read a dense definition; no learning loop; a lookup ends the session |
| Vocabulary trainers | Vocabulary.com, Anki, WordUp, Magoosh | Adaptive practice, spaced repetition, points/badges | Assume reading fluency and English UI; you must pick the words; nothing grows out of a lookup |
| Capture-from-content | Readlang, LingQ, Language Reactor (Netflix/YouTube) | Save words with the sentence you met them in; subtitles | Built for translating between languages; little on meaning depth; no support for low literacy |
| Camera dictionaries | Google Lens, LensDict, Words Lens | Point at a page, get a definition | One-shot; no memory, no review, no story |
| Habit apps | Duolingo | Streaks, XP, leagues drove retention 12%→55% (vendor-reported) | Pressure/loss-aversion mechanics; shame when a streak breaks |

Sources: FluentU, Brighterly, WordPlus, Vibeling reviews of 2026 dictionary/vocabulary apps; Wikipedia and vendor pages for Language Reactor/Readlang/LingQ; StriveCloud, The Decision Lab ("streak creep") on Duolingo.

## What is missing everywhere (our opening)
1. **A lookup that grows.** Nobody turns one lookup into 5–6 well-chosen next words, explained ("why this word for you").
2. **Level without judgment.** Every product either ignores level or asks for a test. We estimate it from gentle, optional signals plus real evidence, and never gate content by age or schooling. Adults with little schooling are the underserved majority in our market.
3. **Meaning depth, not just definition.** Tone, intensity ladder (doubtful -> skeptical -> cynical), "only this word fits" sentences, opposites, word family, where you have seen it.
4. **Your own context.** Save the sentence, the book, the film, the WhatsApp message it came from, and come back to it later.
5. **Voice-first help.** "I don't understand this word" spoken in your own language, answered aloud.
6. **Honest mastery.** Discovery is not mastery; the garden only grows for words you can really use; nothing is lost when you miss a day.
7. **Trust.** Every item shows where it came from and whether a human reviewed it.

## Features (status)
| # | Feature | Status |
|---|---|---|
| 1 | Dictionary from WordNet (161k senses), sense picker | built |
| 2 | AI practice (Groq gpt-oss-120b + blind solver, cached) | built, 10/10 words in live test |
| 3 | Adaptive learning engine, spaced review, sync, login | built |
| 4 | **Word Constellation** (1 word -> 5–6, AI difficulty + learner level) | built, live-tested |
| 5 | Polite learner profile (reading comfort, interests, purpose; age/schooling optional) | built |
| 6 | Meaning depth: tone, intensity ladder, "only this word fits" | built, live-tested |
| 7 | More quiz types (AI) | next |
| 8 | Voice assistant ("I don't understand this word") via Groq Whisper | built, tested with real speech |
| 9 | Capture from camera (book/screen) via on-device OCR | next |
| 10 | Browser extension (select text, press a key, get the meaning) | built (load unpacked to try) |
| 11 | Story/garden that grows with mastery; chapters | next, then frontend redesign |

## Level model (how words are chosen)
Inputs, all optional and explainable:
- **How you read English** (4 friendly options) -> prior level. Never called "test".
- **What you like** (chips) and **why you are here** (work, study, movies, daily life) -> topic match.
- **How far you studied** and **age band**: asked last, with "prefer not to say" as the default, and *only used to tune tone and topics*, never to lock or lower content. (Illiteracy at 30 is common and is not a level of intelligence.)
- **Evidence**: difficulty of words you actually practised successfully (grows in weight with each word). Searching a hard word says nothing about ability.
Target for suggestions = your level + about 0.6 (a stretch, not a leap). Include an **easier stepping-stone** when the word you asked is far above you.

## Retention without shame
- The **garden grows only from mastery**; missing days never removes anything, it just "rests".
- **Spaced review as invitations** ("your words are ready"), not threats.
- **Story chapters** unlock from what you learned (a life-journey arc), so you return to see what happens.
- **Capture loops**: extension + camera + voice make Wordwild part of daily reading, not a separate chore.
- **WhatsApp/Telegram word of the day** for the platform people already use.
- Success metric is *words secure after 30 days*, not minutes spent.

## Acquisition: why would anyone find us
- **Search**: a page per word ("skeptical meaning in Hindi") with Hindi explanation, examples, level. Needs quality gates and human review before mass-publishing (thin AI pages get penalised).
- **Extension** in the Chrome Web Store: every lookup is a free impression, and it drives saves to the site.
- **Shareable cards**: "my week in words" and constellation images for WhatsApp/Instagram.
- **Audience**: Hindi/Punjabi-speaking adults who read little English; workplace and exam users second.

## Risks
- AI content is unreviewed: labelled everywhere; needs editor review before public launch.
- Free-tier Groq limits: quota per learner, caching, backoff; move to paid before launch.
- Extension/camera/voice raise privacy questions: minimise retention, ask consent, show what is sent.
