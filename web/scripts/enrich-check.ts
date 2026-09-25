// Offline check of the Groq client (mocked network) and the enrichment DB helpers (real DB, throwaway ids).
import assert from "node:assert/strict";
process.env.GROQ_API_KEY = "test-key-not-real";
const { generateDraft, solveBlind, predictLevels, MODEL_GENERATE, MODEL_VERIFY } = await import("../src/lib/groq.ts");
const { claimQuota, putEnriched, getEnriched, putFailure, recentFailure } = await import("../src/lib/db.ts");
const core = await import("../../core/src/index.ts");

// ---- mocked network ----
const real = globalThis.fetch; let calls: { url: string; init: any }[] = []; let script: (() => Response)[] = [];
globalThis.fetch = (async (url: any, init: any) => { calls.push({ url: String(url), init }); const f = script.shift(); if (!f) throw new Error("unexpected call"); return f(); }) as any;
const ok = (content: unknown) => () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), { status: 200 });
const status = (n: number) => () => new Response("{}", { status: n });

// 1. request shape: strict json_schema, correct models, bearer from env, no key in body
script = [ok({ answer: 1, alsoCorrect: false })];
const r1 = await solveBlind({ prompt: "Q?", options: ["a", "b", "c"] });
assert.deepEqual(r1, { answer: 1, alsoCorrect: false });
const body = JSON.parse(calls[0].init.body);
assert.equal(calls[0].url, "https://api.groq.com/openai/v1/chat/completions");
assert.equal(body.model, MODEL_VERIFY); assert.equal(body.response_format.type, "json_schema"); assert.equal(body.response_format.json_schema.strict, true);
assert.equal(calls[0].init.headers.authorization, "Bearer test-key-not-real"); assert.ok(!calls[0].init.body.includes("test-key-not-real"));
assert.ok(body.messages[1].content.includes("0: a") && !/correct/i.test(body.messages[1].content), "solver prompt must not leak a key");

// 2. retries 429 then succeeds; gives up after 3 attempts; never retries a 400
calls = []; script = [status(429), ok({ answer: 0, alsoCorrect: false })];
assert.equal((await solveBlind({ prompt: "Q", options: ["a", "b"] })).answer, 0); assert.equal(calls.length, 2);
calls = []; script = [status(500), status(503), status(502)];
await assert.rejects(solveBlind({ prompt: "Q", options: ["a", "b"] })); assert.equal(calls.length, 3);
calls = []; script = [status(400)];
await assert.rejects(solveBlind({ prompt: "Q", options: ["a", "b"] })); assert.equal(calls.length, 1, "400 is not retried");

// 3. malformed / empty output fails closed
calls = []; script = [() => new Response(JSON.stringify({ choices: [{ message: { content: "not json" } }] }), { status: 200 }), () => new Response(JSON.stringify({ choices: [] }), { status: 200 }), () => new Response(JSON.stringify({ choices: [] }), { status: 200 })];
await assert.rejects(solveBlind({ prompt: "Q", options: ["a", "b"] }));
// out-of-range answer index is passed through as-is and rejected by verifyBlind (picked option undefined != key)
calls = []; script = [ok({ answer: 99, alsoCorrect: false })];
assert.equal((await solveBlind({ prompt: "Q", options: ["a", "b"] })).answer, 99);

// 4. generation uses the big model and the lesson schema
calls = []; script = [ok({})]; await generateDraft([{ role: "user", content: "x" }]);
const gb = JSON.parse(calls[0].init.body); assert.equal(gb.model, MODEL_GENERATE); assert.equal(gb.response_format.json_schema.name, "lesson_draft");
assert.equal(gb.response_format.json_schema.schema.additionalProperties, false);
// 5. level predictor refuses a degenerate "everything is 3" answer, retries once, and accepts a varied one
const ws = ["a1","b2","c3","d4","e5","f6","g7"]; const mk = (f: (i: number) => number) => ok({ items: ws.map((lemma, i) => ({ lemma, level: f(i), topics: ["news", "bogus"] })) });
calls = []; script = [mk(() => 3), mk(i => (i % 5) + 1)];
const varied = await predictLevels(ws); assert.equal(calls.length, 2, "degenerate answer triggered exactly one retry");
assert.deepEqual(varied.map(v => v.level), [1, 2, 3, 4, 5, 1, 2]); assert.deepEqual(varied[0].topics, ["news"], "unknown topics are dropped");
calls = []; script = [mk(() => 3), mk(() => 3)];
await assert.rejects(predictLevels(ws), /not usable/); assert.equal(calls.length, 2);
calls = []; script = [ok({ items: ws.slice(0, 2).map((lemma, i) => ({ lemma, level: 2 + i, topics: [] })) })];
assert.equal((await predictLevels(ws.slice(0, 2))).length, 2, "small batches are not judged for spread");
globalThis.fetch = real;

// ---- real DB helpers ----
const id = `zz_test%5:00:00:x:00`, u1 = `test_${Math.random().toString(36).slice(2)}`;
const sql = (await import("@neondatabase/serverless")).neon(process.env.DATABASE_URL!);
try {
  const fakeSense = { senseId: id, lemma: "zz_test" } as any;
  assert.equal(await getEnriched(id), null);
  await putEnriched(id, fakeSense, "m", "v", 1); await putEnriched(id, { ...fakeSense, lemma: "changed" }, "m2", "v", 1);
  assert.equal((await getEnriched(id))?.lemma, "zz_test", "first validated lesson wins; no silent overwrite");
  assert.equal(await recentFailure(id), null);
  await putFailure(id + "f", "verify", ["g1: solver chose a different answer"]);
  assert.equal((await recentFailure(id + "f"))?.stage, "verify");
  assert.equal(await recentFailure(id + "f", 0), null, "failure memory expires");
  const results = await Promise.all(Array.from({ length: 6 }, () => claimQuota(u1, 3)));
  assert.equal(results.filter(Boolean).length, 3, "quota is atomic under concurrent requests");
  console.log("enrich-check: all assertions passed", { models: [MODEL_GENERATE, MODEL_VERIFY] });
} finally {
  await sql.query(`delete from ww_enriched where sense_id = $1`, [id]);
  await sql.query(`delete from ww_enrich_failed where sense_id = $1`, [id + "f"]);
  await sql.query(`delete from ww_enrich_usage where user_id = $1`, [u1]);
}
