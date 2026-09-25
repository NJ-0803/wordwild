# Where the word-meaning agent can fail, and what we did (2026-09-26)

Method: `web/scripts/lookup-audit.ts` runs ~80 awkward inputs through the real lookup and prints what happens. Run it after any change: `cd web && node --env-file=.env.local --import ./scripts/alias.mjs --experimental-strip-types scripts/lookup-audit.ts`.
Rule for every fix: never guess silently. Say what was matched, offer alternatives, or say plainly why it cannot be looked up.

| # | Failure found (before) | User harm | Fix (now) | Where |
|---|---|---|---|---|
| 1 | Irregular forms found nothing: went, mice, children, ran, bought, geese, was, wolves, knives, happier | "Not in the dictionary" for everyday words | Table of ~250 irregular forms plus ending rules (ier/iest, ves, ies...); result says "“went” is a form of “go”" | core/query.ts |
| 2 | Wrong base guessed: hoping -> hop | Wrong word learnt | CVC rule: single short stem prefers +e (hope); doubled letter prefers stem (hopping -> hop) | core/query.ts |
| 3 | Verb forms opened on noun meanings (ghosting -> "ghost, noun") | Confusing first meaning | Part-of-speech hints per form (ing/ed -> verb, ly -> adverb, irregular tables carry their own) | db.ts lookupDict |
| 4 | Ambiguous forms (saw, leaves, better, left) showed only the literal word | Missing the reading they meant | Show both readings, literal word first, each labelled | db.ts lookupDict |
| 5 | Typos returned nothing (definately, recieve, seperate, accomodate, embarass) | Dead end | "Did you mean": edit distance + trigram similarity, transpositions (recieve -> receive) ranked first; offered as chips, never applied silently | db.ts suggestLemmas |
| 6 | Trailing punctuation and quotes were rejected ("serendipity." "“word”" "(word)") | The most common paste is refused | Cleaned, not rejected: quotes, brackets, punctuation, possessive 's, invisible characters (zero-width, soft hyphen) | core/query.ts |
| 7 | Rejections were silent or said "could not check" | No idea what to do next | Plain reason per kind: numbers, URL, sentence, other script, symbols, contraction, too long, empty, abbreviation | core/query.ts |
| 8 | Phrases in another form ("Gave Up", "ice creams") found nothing | Phrase learners fail | First/last word is inflected: gave up -> give up | core/query.ts |
| 9 | Digits inside a word became a fake word ("4th" -> "th") | Nonsense result | Any digit -> explained as not a word | core/query.ts |
| 10 | Speed: one database round trip per candidate spelling, another for saved AI help (300 ms to 2 s) | Slow, and worse for unknown words | One round trip for all candidates with saved AI help joined in; 10-minute in-memory cache; CDN cache header | db.ts |
| 11 | Extension did nothing when a drag selection included quotes, commas or brackets | Feels broken | Selection cleaned the same way; server explains what it cannot look up | extension/shared.js |
| 12 | Extension showed "not in dictionary" with no help | Dead end | Shows "Did you mean" and the plain reason; forms are explained | extension |
| 13 | Telegram, WhatsApp, voice each did their own cleaning | Different answers on different surfaces | One shared cleaner and lookup; suggestions and form notes on every surface | lib/telegram, whatsapp, voice |
| 14 | Prompt-injection or SQL-like text in the search box | Risk to AI prompts | Only ever reaches the dictionary as a letters-only key; sentences (over 3 words) are refused before any AI is called; queries are parameterised | query.ts + tests |

## Still failing, on purpose or for later
- **Slang, names, brands, new words** (yeet, bae, Delhi, Google as a company): not in WordNet. We say so and never invent a meaning. Idea: an editor-reviewed slang list.
- **Acronyms** (LOL, ASAP): flagged as abbreviations, no meaning yet. Idea: small reviewed list.
- **Hindi and Hinglish typed** (शर्म, shukriya): explained as "we look up English"; voice can take Hindi. Idea: reviewed Hindi to English glossary.
- **Contractions** (don't): explained, not looked up.
- **Sense order** ("bank" opens on the river bank, WordNet's own order): the picker asks which meaning; we have no frequency data to reorder. Idea: use the learner's context sentence (already done for voice and scan) in the capture screen.
- **Rule-based forms can still be wrong** for rare words; the dictionary decides which candidates exist, and the note always says what was matched.
- **AI parts** (practice, depth, coach) are unreviewed by an editor and labelled as such.
- **Hard definitions**: WordNet wording can be difficult ("(of a nose) blocked"); the simple-words version comes from checked AI help when it exists.
- **Speed**: the 300 ms target is met server-side (database and functions are both in US East); a person's distance adds network time.
