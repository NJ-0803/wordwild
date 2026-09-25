# AI providers, limits and how to scale word help (2026-09-26)

## The problem
The raw dictionary gives a definition and pronunciation but no examples or related words for most words (for example "serendipity"). The Word Coach fills this gap, but it is AI-generated, and there are hundreds of thousands of words. One free AI account cannot cover that.

## Measured limits (Groq free tier, read from Groq's own responses)
- 1,000 requests per day per model, 8,000 tokens per minute, and **200,000 tokens per day per model**.
- One checked coach costs about 3,000 to 4,000 tokens (a draft on the large model, one batched check on the small model). So Groq alone gives roughly **50 to 70 words a day**.
- This was hit today: gpt-oss-20b showed 199,903 of 200,000 daily tokens used.

## What is built
1. **Provider chain** (`web/src/lib/groq.ts`): providers are tried in order, and a provider that is out of allowance rests (1 hour for a daily limit, 1 minute for a per-minute limit) while the next one answers.
   - `groq` needs `GROQ_API_KEY`.
   - `gemini` (Google) needs `GEMINI_API_KEY`. Models: `GEMINI_MODEL_GENERATE` (default `gemini-2.5-flash`) and `GEMINI_MODEL_VERIFY` (default `gemini-2.5-flash-lite`).
   - `openrouter` needs `OPENROUTER_API_KEY`, model in `OPENROUTER_MODEL` (default a free gpt-oss).
   - Gemini's structured-output format does not accept `additionalProperties`, so it is stripped for non-Groq providers.
2. **Cheaper checks:** all blind checks for a word are asked in one batched call (2 model calls per word instead of about 10), which cuts tokens and requests.
3. **On demand, cached for everyone:** opening a word that has no coach generates it once (for anyone, signed in or not, within a shared daily budget `COACH_ANON_DAILY`, default 300, plus each signed-in learner's own 20 a day). The public word page does this automatically. After that everyone gets it instantly.
4. **`npm run ai:probe`** tests every configured provider with three tiny requests, so a new key or model name is checked in seconds.
5. **`npm run coach:batch`** fills a frequency list in the background; it now uses the chain and stops when every provider refuses.

## What you need to do (I cannot create keys)
1. Go to https://aistudio.google.com/apikey , sign in with Google, click **Create API key**.
2. Copy the key, then in a terminal (the `!` runs it inside Claude Code):
   `! pbpaste | sed 's/^/GEMINI_API_KEY=/' >> ~/projects/wordwild/web/.env.local`
3. Add it to the live site: `! cd ~/projects/wordwild && pbpaste | vercel env add GEMINI_API_KEY production --sensitive` then `vercel deploy --prod --yes`.
4. Check it: `cd ~/projects/wordwild/web && npm run ai:probe` (each line should say `via gemini:...` when Groq is resting).
If a Gemini model name has changed, set `GEMINI_MODEL_GENERATE` and `GEMINI_MODEL_VERIFY` to a current one from https://ai.google.dev/gemini-api/docs/models .
Untested: the Gemini path has not been run yet because there is no key here. Everything else is tested.

## How to reach "lakhs of words" honestly
- **Free tiers cover hundreds of words a day, not hundreds of thousands.** Demand-driven generation (only words people actually open) plus two or three free providers covers the words that matter first.
- **A paid plan is cheap at this scale.** Rough estimate, to be checked against current prices: about 4,000 tokens per word on a small fast model is a fraction of a cent per word, so on the order of a hundred dollars to cover 100,000 words. Provide a paid key as `GEMINI_API_KEY` (or another provider) and the same code runs faster.
- **Order of work:** (1) words people open, (2) a frequency-ranked list, (3) the long tail on demand only.
- **Quality stays the same at any scale:** every example passes deterministic checks and a second model's blind check, and is labelled as AI-drafted and not reviewed by an editor. A human reviewer for the top few thousand words is the real quality step.
