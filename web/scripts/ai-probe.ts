// Tests every configured AI provider with a tiny structured request, so a new key or model name is checked in seconds.
//   node --no-warnings --env-file=.env.local --import ./scripts/alias.mjs --experimental-strip-types scripts/ai-probe.ts
import { configuredProviders, lastUsed, solveBlind, solveMany, draftCoach } from "../src/lib/groq.ts";
console.log("Providers with a key:", configuredProviders().join(", ") || "none");
for (const [label, run] of [
  ["solveBlind (verify model)", async () => JSON.stringify(await solveBlind({ prompt: "Which is a fruit?", options: ["apple", "chair"] }))],
  ["solveMany (verify model, batch)", async () => JSON.stringify(await solveMany([{ prompt: "Which is a fruit?", options: ["apple", "chair"] }, { prompt: "Which is a colour?", options: ["blue", "table", "run"] }]))],
  ["draftCoach (generate model, strict schema)", async () => { const d = await draftCoach({ lemma: "serendipity", pos: "noun", definition: "good luck in making unexpected and fortunate discoveries", synonyms: [] }); return `${d.examples.length} examples, hook: ${d.memoryHook.slice(0, 50)}`; }],
] as const) {
  const t = Date.now();
  try { const out = await run(); console.log(`OK   ${label}  ${Date.now() - t} ms  via ${lastUsed}\n     ${out}`); } catch (e) { console.log(`FAIL ${label}: ${(e as Error).message}`); }
}
