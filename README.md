# Wordwild

**Live site: https://wordwild-seven.vercel.app**

A respectful, adaptive vocabulary product for adult English learners, with Hindi explanations. Save a word you meet, understand it in simple words, practise it, and watch a town grow from the words you really learn.

- **Website** (`web/`): Next.js 16, Clerk sign-in, Neon Postgres, Vercel. Word coach, daily journey, word vault, 3D town, daily puzzles (Word of the Day, Unscramble, Meaning Match), camera scan and voice.
- **Core** (`core/`): pure TypeScript learning engine (spaced review, town, puzzles). Run its tests with `cd core && node --test`.
- **Chrome extension** (`extension/`): select a word on any page for its meaning, or Quick save it and add it to your words the next time you open the site. Install steps are on the site at [/extension](https://wordwild-seven.vercel.app/extension).
- **Docs** (`docs/`): status, economy, lookup failures, AI providers, transformation plan.

## Run locally

```bash
cd web
npm install
cp .env.example .env.local   # add your own keys; never commit them
npm run dev
```

Data: WordNet (CC BY 4.0), CMUdict, Kenney assets (CC0). See the Credits page on the site.
