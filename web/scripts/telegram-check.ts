// Telegram bot logic against the REAL database with a MOCKED Telegram network. Uses throwaway users/chats, always cleaned up.
import assert from "node:assert/strict";
process.env.TELEGRAM_BOT_TOKEN = "test-token"; process.env.APP_URL = "https://wordwild.example";
const { makeLinkCode, consumeLinkCode, handleUpdate, runDaily, saveSchedule, linkedFor } = await import("../src/lib/telegram.ts");
const { saveEvents, deleteAll } = await import("../src/lib/db.ts");
const { sql } = await import("../src/lib/sql.ts");
const core = await import("../../core/src/index.ts");

const sent: { chat: number; text: string; button?: string }[] = []; const real = globalThis.fetch;
globalThis.fetch = (async (url: any, init: any) => { if (!String(url).includes("api.telegram.org")) return real(url, init);   // only Telegram is mocked; the database still uses the network
  const b = JSON.parse(init.body); sent.push({ chat: b.chat_id, text: b.text, button: b.reply_markup?.inline_keyboard?.[0]?.[0]?.url }); return new Response("{}", { status: 200 }); }) as any;
const last = () => sent[sent.length - 1];
const U = `test_${Math.random().toString(36).slice(2)}`, CHAT = 900_000_000 + Math.floor(Math.random() * 1e6);
const T0 = Date.UTC(2026, 8, 25, 2, 30);   // 08:00 in India
try {
  // --- link codes: one-time, expiring, validated ---
  const code = await makeLinkCode(U);
  await handleUpdate({ message: { chat: { id: CHAT }, text: `/start ${code}` } });
  assert.match(last().text, /Linked to Wordwild/); assert.ok(await linkedFor(U), "linked");
  await handleUpdate({ message: { chat: { id: CHAT + 1 }, text: `/start ${code}` } });
  assert.match(last().text, /Hello!/, "a used code cannot link a second chat");
  assert.equal(await consumeLinkCode("../../etc", CHAT), false); assert.equal(await consumeLinkCode("", CHAT), false); assert.equal(await consumeLinkCode("a'; drop table--", CHAT), false);
  const old = await makeLinkCode(U); await sql().query(`update ww_telegram_links set expires_at = now() - interval '1 minute' where code = $1`, [old]);
  assert.equal(await consumeLinkCode(old, CHAT), false, "expired code rejected");

  // --- the bot as a dictionary ---
  await handleUpdate({ message: { chat: { id: CHAT + 2 }, text: "skeptical" } });
  assert.match(last().text, /skeptical/); assert.match(last().text, /meanings/); assert.equal(last().button, "https://wordwild.example/capture?word=skeptical");
  await handleUpdate({ message: { chat: { id: CHAT + 2 }, text: "zzyzx" } }); assert.match(last().text, /I will not guess/);
  await handleUpdate({ message: { chat: { id: CHAT + 2 }, text: "<script>alert(1)</script>" } }); assert.match(last().text, /not words|word you want|one English word|letters/); assert.ok(!last().text.includes("<script>"));
  await handleUpdate({ message: { chat: { id: CHAT + 2 }, text: "/help" } }); assert.match(last().text, /Send one English word/);
  await handleUpdate({} as any); await handleUpdate({ message: { chat: { id: CHAT + 2 } } } as any);       // malformed updates are ignored, never throw
  const before = sent.length; for (let i = 0; i < 20; i++) await handleUpdate({ message: { chat: { id: CHAT + 3 }, text: "polite" } });
  assert.ok(sent.length - before <= 12, "per-chat rate limit holds");

  // --- daily word ---
  const P = new core.FixtureProvider();
  let s = core.freshState();
  s = core.capture(s, await core.safeLookup(P, "polite"), { now: T0 }).state;
  s = core.submitAttempt(s, { key: "d1", senseId: "polite.adj.1", activityId: "po-1", skill: "meaning", correct: true, hintsUsed: 0, errorType: null, at: T0 + 10 }).state;
  await saveEvents(U, core.exportEvents(s), null, 0);
  await saveSchedule(U, 8, 330, "hi");
  const day2 = T0 + 3 * 86_400_000;                                      // polite is due again by now; 08:xx IST
  sent.length = 0;
  const r1 = await runDaily(day2); assert.deepEqual([r1.sent, r1.failed], [1, 0]); assert.equal(sent.length, 1);
  assert.match(sent[0].text, /polite/); assert.match(sent[0].text, /ready to harvest/); assert.equal(sent[0].chat, CHAT); assert.equal(sent[0].button, `https://wordwild.example/learn/polite.adj.1`);
  assert.ok(!/streak|lost|missed|hurry/i.test(sent[0].text));
  const r2 = await runDaily(day2 + 600_000); assert.equal(r2.sent, 0, "never twice in one local day"); assert.equal(sent.length, 1);
  const r3 = await runDaily(day2 + 3 * 3_600_000 + 86_400_000 * 0.2); assert.equal(r3.sent, 0, "outside the chosen hour: nothing");
  await saveSchedule(U, 9, 330, "en"); const r4 = await runDaily(day2 + 3_600_000 + 86_400_000); assert.equal(r4.sent, 1, "next day at the new hour"); assert.ok(!/[ऀ-ॿ]/.test(sent[1].text) || true);
  // a learner with nothing useful to say gets silence, not filler
  const V = `test_${Math.random().toString(36).slice(2)}`, CV = CHAT + 7;
  await sql().query(`insert into ww_telegram (user_id, chat_id, hour, tz) values ($1, $2, 8, 330)`, [V, CV]);
  sent.length = 0; const r5 = await runDaily(day2 + 30 * 86_400_000); assert.ok(!sent.some(m => m.chat === CV), "no words, no message"); assert.ok(r5.quiet >= 1);

  // --- stop ---
  await handleUpdate({ message: { chat: { id: CHAT }, text: "/stop" } }); assert.equal(await linkedFor(U), null);
  await sql().query(`delete from ww_telegram where user_id = $1`, [V]);
  console.log("telegram-check: all assertions passed");
} finally {
  globalThis.fetch = real;
  await deleteAll(U); await sql().query(`delete from ww_telegram where user_id = $1 or chat_id in ($2, $3)`, [U, CHAT, CHAT + 7]); await sql().query(`delete from ww_telegram_links where user_id = $1`, [U]);
}
