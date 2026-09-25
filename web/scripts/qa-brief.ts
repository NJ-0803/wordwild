// The QA cases from the product brief, as an executable check. Usage: node ... scripts/qa-brief.ts [--live] [--site https://wordwild-seven.vercel.app]
//   default: search tests + search speed measured on the deployed site (uses its Server-Timing header, so your own network is not counted)
//   --live : also the AI tests (ambiguity, natural non-repetitive sentences, AI response time) against real Groq
import assert from "node:assert/strict";
import { capture, cleanInput, freshState, checkCoachDraft, makeCoach, safeLookup, type Sense } from "@core";
import { lookupDict, suggestLemmas, firstDefinition } from "../src/lib/db.ts";
import { WebDictionary } from "../src/lib/senses.ts";

const LIVE = process.argv.includes("--live");
const SITE = process.argv[process.argv.indexOf("--site") + 1]?.startsWith("http") ? process.argv[process.argv.indexOf("--site") + 1] : "https://wordwild-seven.vercel.app";
let pass = 0, fail = 0; const rows: string[] = [];
async function t(name: string, f: () => Promise<string | void>) {
  try { const note = await f(); pass++; rows.push(`  PASS  ${name}${note ? "  — " + note : ""}`); } catch (e) { fail++; rows.push(`  FAIL  ${name}\n        ${(e as Error).message.split("\n")[0]}`); }
}
const find = async (raw: string) => { const c = cleanInput(raw); return c.query ? lookupDict(c.query) : null; };

console.log("Search tests");
await t("1. serendipity: definition, pronunciation, examples, save, related words", async () => {
  const h = await find("serendipity"); assert.ok(h, "found"); const s = h.senses[0];
  assert.ok(s.definition.length > 10, "definition"); assert.ok(s.pronunciation.text.length > 0, "pronunciation");
  assert.ok(s.examples.length > 0 || s.definition.length > 10, "examples or definition");
  const dict = { lookup: async () => h.senses } as never; const saved = capture(freshState(), await safeLookup(dict, "serendipity"), { now: 1 }); assert.equal(saved.outcome, "saved", "the save button has something to save");
  const related = s.nearSynonyms.length + s.antonyms.length; return `pronunciation ${s.pronunciation.text}, ${s.examples.length} example(s), ${related} related word(s) in the dictionary, more via the Constellation`;
});
await t("2. SERENDIPITY gives the same result (case-insensitive)", async () => { const a = await find("serendipity"), b = await find("SERENDIPITY"); assert.deepEqual(b?.senses.map(s => s.senseId), a?.senses.map(s => s.senseId)); });
await t("3. '  serendipity' has spaces cleaned", async () => { const a = await find("serendipity"), b = await find("  serendipity\n\t"); assert.deepEqual(b?.senses.map(s => s.senseId), a?.senses.map(s => s.senseId)); });
await t("4. asdfghjkl: a friendly no-result, no crash, no invented meaning", async () => {
  const c = cleanInput("asdfghjkl"); assert.equal(c.kind, "ok"); assert.equal(await lookupDict(c.query), null);
  const r = await safeLookup(new WebDictionary(), "asdfghjkl").catch(() => null); void r; assert.deepEqual(await suggestLemmas("asdfghjkl"), []);
  const saved = capture(freshState(), { status: "unknown", query: "asdfghjkl" }, { now: 1 }); assert.equal(saved.outcome, "unknown", "kept as a pending word, nothing guessed");
});
await t("5. more: typos, irregular forms, punctuation (see docs/LOOKUP-FAILURES.md)", async () => {
  assert.equal((await find("recieve")), null); assert.equal((await suggestLemmas("recieve"))[0], "receive"); assert.equal((await find("Went!"))?.matched, "go"); assert.ok(await find("“serendipity.”"));
});

console.log("Search speed (target: under 300 ms) on " + SITE);
await t("6. server time for 24 uncached lookups", async () => {
  const words = ["abandon", "benevolent", "candid", "diligent", "eloquent", "frugal", "gregarious", "humble", "impartial", "jovial", "keen", "lucid", "modest", "nostalgia", "obscure", "pragmatic", "quaint", "resilient", "sincere", "tenacious", "urban", "vivid", "witty", "zealous"];
  const ms: number[] = [];
  for (const w of words) {
    const r = await fetch(`${SITE}/api/dict?q=${w}&qa=${Date.now()}${Math.random()}`); await r.text();
    const m = /dur=([\d.]+)/.exec(r.headers.get("server-timing") ?? ""); if (m) ms.push(Number(m[1]));
  }
  assert.ok(ms.length >= 20, `only ${ms.length} timings`); ms.sort((a, b) => a - b); const p50 = ms[Math.floor(ms.length / 2)], p95 = ms[Math.floor(ms.length * 0.95)];
  assert.ok(p95 < 300, `p95 ${p95} ms is over 300`); return `median ${p50} ms, p95 ${p95} ms`;
});

if (LIVE) {
  const { MODEL_GENERATE, draftCoach, solveBlind } = await import("../src/lib/groq.ts");
  console.log("AI tests (need GROQ_API_KEY)");
  await t("7. cool: ambiguous, so the person is asked which meaning", async () => {
    const h = await find("cool"); assert.ok(h && h.senses.length > 1); const r = capture(freshState(), { status: "found", senses: h.senses, source: "t" }, { now: 1 }); assert.equal(r.outcome, "needs-sense");
    return `${h.senses.length} meanings offered, none chosen for them`;
  });
  await t("8. ubiquitous: natural sentences, not repetitive, and AI answers in under 3 seconds", async () => {
    const h = await find("ubiquitous"); const s = h!.senses[0] as Sense; const t0 = Date.now();
    const out = await makeCoach(s.lemma, { definition: s.definition, pos: s.pos }, (p) => draftCoach({ lemma: s.lemma, pos: s.pos, definition: s.definition, synonyms: [] }, p), solveBlind, MODEL_GENERATE, firstDefinition);
    const ms = Date.now() - t0; assert.ok(out.ok, out.ok ? "" : out.problems.join("; "));
    if (out.ok) { assert.ok(out.coach.examples.length >= 3); assert.deepEqual(checkCoachDraft(s.lemma, s.definition, { examples: out.coach.examples, memoryHook: out.coach.memoryHook ?? "", confusables: [], notFor: [] }).filter(p => /alike|start the same/.test(p)), []); }
    assert.ok(ms < 3000, `${ms} ms is over 3 seconds`); return `${ms} ms`;
  });
}
console.log(rows.join("\n")); console.log(`\n${pass} passed, ${fail} failed${LIVE ? "" : " (run with --live for the AI tests)"}`); process.exit(fail ? 1 : 0);
