// WhatsApp channel against the REAL database with a MOCKED Meta Graph API. Throwaway users and numbers, always cleaned up.
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
Object.assign(process.env, { WHATSAPP_ACCESS_TOKEN: "test-token", WHATSAPP_PHONE_NUMBER_ID: "111222333", APP_URL: "https://wordwild.example", WHATSAPP_VERIFY_TOKEN: "verify-me", WHATSAPP_APP_SECRET: "app-secret" });
delete process.env.WHATSAPP_DAILY_TEMPLATE;
const W = await import("../src/lib/whatsapp.ts"); const { saveEvents, deleteAll } = await import("../src/lib/db.ts"); const { sql } = await import("../src/lib/sql.ts"); const core = await import("../../core/src/index.ts");

const graph: any[] = []; const real = globalThis.fetch;
globalThis.fetch = (async (url: any, init: any) => { if (!String(url).includes("graph.facebook.com")) return real(url, init); graph.push(JSON.parse(init.body)); return new Response("{}", { status: 200 }); }) as any;
const texts = () => graph.filter(g => g.type === "text").map(g => g.text.body as string); const lastText = () => texts().at(-1) ?? "";
const sign = (body: string, secret = "app-secret") => "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
const rid = () => `wamid.${Math.random().toString(36).slice(2)}`;
const N = () => String(910000000000 + Math.floor(Math.random() * 1e9)); const NUM = N(), NUM2 = N(), NUM3 = N();
const U = `test_${Math.random().toString(36).slice(2)}`, U2 = `test_${Math.random().toString(36).slice(2)}`;
const msg = (from: string, body: string, type = "text") => ({ id: rid(), from, type, text: type === "text" ? body : undefined });
try {
  // ---- signature: raw body, constant time, no shortcuts ----
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
  assert.ok(W.verifySignature(body, sign(body), "app-secret"));
  assert.ok(!W.verifySignature(body + " ", sign(body), "app-secret"), "one extra byte breaks it");
  assert.ok(!W.verifySignature(body, sign(body, "other"), "app-secret"), "wrong secret");
  assert.ok(!W.verifySignature(body, null, "app-secret") && !W.verifySignature(body, "", "app-secret") && !W.verifySignature(body, sign(body).replace("sha256=", "sha1="), "app-secret"));
  assert.ok(!W.verifySignature(body, "sha256=abc", "app-secret"), "wrong length does not throw");
  assert.ok(!W.verifySignature(body, sign(body), ""), "no configured secret means nothing is trusted");
  // ---- handshake ----
  const q = (o: Record<string, string>) => new URLSearchParams(o);
  assert.equal(W.verifyHandshake(q({ "hub.mode": "subscribe", "hub.verify_token": "verify-me", "hub.challenge": "1234" }), "verify-me"), "1234");
  assert.equal(W.verifyHandshake(q({ "hub.mode": "subscribe", "hub.verify_token": "nope", "hub.challenge": "1" }), "verify-me"), null);
  assert.equal(W.verifyHandshake(q({ "hub.mode": "unsubscribe", "hub.verify_token": "verify-me" }), "verify-me"), null);
  assert.equal(W.verifyHandshake(q({ "hub.mode": "subscribe", "hub.verify_token": "" }), ""), null, "an unset token never matches an empty one");
  // ---- payload parsing ----
  const wrap = (messages: any[], field = "messages", object = "whatsapp_business_account") => ({ object, entry: [{ changes: [{ field, value: { messages } }] }] });
  assert.equal(W.extractMessages(wrap([{ id: "a", from: NUM, type: "text", text: { body: "hi" } }])).length, 1);
  assert.equal(W.extractMessages(wrap([], "messages")).length, 0); assert.equal(W.extractMessages({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { statuses: [{}] } }] }] }).length, 0, "delivery receipts are ignored");
  assert.equal(W.extractMessages(wrap([{ id: "a", from: NUM, type: "text", text: { body: "x" } }], "account_alerts")).length, 0);
  assert.equal(W.extractMessages(wrap([{ id: "a", from: NUM, type: "text", text: { body: "x" } }], "messages", "page")).length, 0);
  for (const bad of [null, {}, "x", 5, { entry: 3 }, wrap([{ id: 1, from: NUM }]), wrap([{ id: "a", from: "abc" }]), wrap([{ id: "a", from: "1'; drop--" }])]) assert.equal(W.extractMessages(bad).length, 0);

  // ---- linking: opt-in by messaging us, one-time, expiring, validated ----
  const code = await W.makeWaLink(U);
  await W.handleMessage(msg(NUM, `LINK ${code}`));
  assert.match(lastText(), /Linked to Wordwild/); assert.ok(await W.waLinkedFor(U));
  const cons = (await sql().query(`select consent_at, window_until > now() as open from ww_whatsapp where user_id = $1`, [U])) as any[]; assert.ok(cons[0].consent_at && cons[0].open, "consent time recorded and window open");
  await W.handleMessage(msg(NUM2, `LINK ${code}`)); assert.match(lastText(), /did not work/, "a used code cannot link a second number");
  await W.handleMessage(msg(NUM2, "LINK ../../etc")); assert.ok(!/Linked/.test(lastText()));
  const old = await W.makeWaLink(U2); await sql().query(`update ww_whatsapp_links set expires_at = now() - interval '1 minute' where code = $1`, [old]);
  await W.handleMessage(msg(NUM3, `LINK ${old}`)); assert.match(lastText(), /did not work/, "expired");

  // ---- the bot as a dictionary ----
  await W.handleMessage(msg(NUM2, "skeptical")); assert.match(lastText(), /\*skeptical\*/); assert.match(lastText(), /wordwild\.example\/capture\?word=skeptical/);
  await W.handleMessage(msg(NUM2, "zzyzx")); assert.match(lastText(), /I will not guess/);
  await W.handleMessage(msg(NUM2, "<script>x</script>")); assert.match(lastText(), /not words|word you want|one English word|letters/);
  await W.handleMessage(msg(NUM2, "*bold*")); assert.ok(!/\*\*/.test(lastText()));
  await W.handleMessage(msg(NUM2, "", "image")); assert.match(lastText(), /text messages/);
  await W.handleMessage(msg(NUM2, "help")); assert.match(lastText(), /Send me one English word/);
  // ---- replay protection ----
  const dup = msg(NUM2, "polite"); const before = graph.length; await W.handleMessage(dup); const afterFirst = graph.length; await W.handleMessage(dup); await W.handleMessage(dup);
  assert.equal(afterFirst - before, 1); assert.equal(graph.length, afterFirst, "the same message id is never processed twice");
  // ---- rate limit ----
  const b4 = graph.length; for (let i = 0; i < 20; i++) await W.handleMessage(msg(NUM3, "polite")); assert.ok(graph.length - b4 <= 12);

  // ---- daily word ----
  const P = new core.FixtureProvider(); const T0 = Date.UTC(2026, 8, 25, 2, 30);
  let s = core.freshState(); s = core.capture(s, await core.safeLookup(P, "polite"), { now: T0 }).state;
  s = core.submitAttempt(s, { key: "d1", senseId: "polite.adj.1", activityId: "po-1", skill: "meaning", correct: true, hintsUsed: 0, errorType: null, at: T0 + 10 }).state;
  await saveEvents(U, core.exportEvents(s), null, 0); await W.saveWaSchedule(U, 8, 330, "en");
  const day2 = T0 + 3 * 86_400_000;
  // inside the window: free text
  await sql().query(`update ww_whatsapp set window_until = now() + interval '20 hours' where user_id = $1`, [U]);
  graph.length = 0; const r1 = await W.runDailyWhatsApp(Date.now() > day2 ? Date.now() : day2);
  // (the window is evaluated against the supplied clock, so compute it explicitly)
  const nowMs = day2; await sql().query(`update ww_whatsapp set last_sent_day = -1, window_until = to_timestamp($2 / 1000.0) + interval '5 hours' where user_id = $1`, [U, nowMs]); graph.length = 0;
  const r2 = await W.runDailyWhatsApp(nowMs); assert.equal(r2.sent, 1); assert.ok(/polite/.test(lastText()) && /ready to harvest/.test(lastText()) && /Reply STOP/.test(lastText()) && /wordwild\.example\/learn\/polite\.adj\.1/.test(lastText()));
  assert.ok(!/streak|lost|missed|hurry/i.test(lastText()));
  assert.equal((await W.runDailyWhatsApp(nowMs + 600_000)).sent, 0, "never twice in a local day"); assert.equal((await W.runDailyWhatsApp(nowMs + 5 * 3_600_000)).sent, 0, "outside the chosen hour");
  // outside the window WITHOUT a template: silence, and it says why
  await sql().query(`update ww_whatsapp set last_sent_day = -1, window_until = to_timestamp($2 / 1000.0) - interval '1 hour' where user_id = $1`, [U, nowMs]); graph.length = 0;
  const r3 = await W.runDailyWhatsApp(nowMs); assert.equal(r3.sent, 0); assert.equal(r3.needsTemplate, 1); assert.equal(graph.length, 0, "no template configured: nothing is sent outside the window");
  // outside the window WITH a template
  process.env.WHATSAPP_DAILY_TEMPLATE = "wordwild_daily_word"; process.env.WHATSAPP_TEMPLATE_LANG = "en";
  await sql().query(`update ww_whatsapp set last_sent_day = -1 where user_id = $1`, [U]); graph.length = 0;
  const r4 = await W.runDailyWhatsApp(nowMs); assert.equal(r4.sent, 1); const t = graph.at(-1); assert.equal(t.type, "template"); assert.equal(t.template.name, "wordwild_daily_word"); assert.equal(t.template.language.code, "en");
  assert.deepEqual(t.template.components[0].parameters.map((p: any) => p.text).slice(0, 1), ["polite"]); assert.equal(t.to, NUM);
  process.env.WHATSAPP_TEMPLATE_PARAMS = "0"; await sql().query(`update ww_whatsapp set last_sent_day = -1 where user_id = $1`, [U]); graph.length = 0;
  await W.runDailyWhatsApp(nowMs); assert.equal(graph.at(-1).template.components, undefined, "parameter-less templates (Meta's hello_world) are supported"); delete process.env.WHATSAPP_TEMPLATE_PARAMS;

  // ---- STOP removes the number ----
  await W.handleMessage(msg(NUM, "STOP")); assert.match(lastText(), /removed your number/); assert.equal(await W.waLinkedFor(U), null);
  const left = (await sql().query(`select count(*)::int c from ww_whatsapp where wa_id = $1`, [NUM])) as any[]; assert.equal(left[0].c, 0);
  // ---- account deletion removes it too ----
  const c2 = await W.makeWaLink(U); await W.handleMessage(msg(NUM, `LINK ${c2}`)); assert.ok(await W.waLinkedFor(U)); await deleteAll(U); assert.equal(await W.waLinkedFor(U), null);
  console.log("whatsapp-check: all assertions passed");
} finally {
  globalThis.fetch = real; delete process.env.WHATSAPP_DAILY_TEMPLATE;
  await deleteAll(U); await deleteAll(U2); await sql().query(`delete from ww_whatsapp where wa_id in ($1, $2, $3)`, [NUM, NUM2, NUM3]); await sql().query(`delete from ww_whatsapp_links where user_id in ($1, $2)`, [U, U2]);
}
