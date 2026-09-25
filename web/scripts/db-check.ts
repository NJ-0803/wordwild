// Integration check of the data layer against the real database, using throwaway test users that are always deleted.
import assert from "node:assert/strict";
import { loadAll, saveEvents, deleteAll, lookupDict, suggestLemmas } from "../src/lib/db.ts";
import { FixtureProvider, safeLookup, freshState, capture, submitAttempt, exportEvents, rebuildState, sanitizeEvents } from "../../core/src/index.ts";

const A = `test_${Math.random().toString(36).slice(2)}`, B = `test_${Math.random().toString(36).slice(2)}`;
const T0 = 1_800_000_000_000;
try {
  let s = freshState();
  s = capture(s, await safeLookup(new FixtureProvider(), "euphemism"), { now: T0, context: "my private note" }).state;
  s = submitAttempt(s, { key: "k1", senseId: "euphemism.n.1", activityId: "eu-1", skill: "meaning", correct: true, hintsUsed: 0, errorType: null, at: T0 + 1000 }).state;
  s = submitAttempt(s, { key: "k2", senseId: "euphemism.n.1", activityId: "eu-2", skill: "usage", correct: false, hintsUsed: 0, errorType: "register", at: T0 + 2000 }).state;
  const ev = sanitizeEvents(exportEvents(s));

  const town = [{ key: "build:market", kind: "build" as const, ref: "market", at: T0 + 5000 }, { key: "claim:5:plant2:0", kind: "claim" as const, ref: "5:plant2:0", at: T0 + 6000 }, { key: "scene:home-tea", kind: "scene" as const, ref: "home-tea", at: T0 + 7000 }];
  await saveEvents(A, { ...ev, town }, { explainLang: "hi", textScale: 1.25, reducedMotion: false, audioFirst: true, simpleMode: true }, 100);
  await saveEvents(A, { ...ev, town }, null, 0);                       // retried request: must not duplicate
  await saveEvents(A, { ...ev, town }, null, 0);
  let got = await loadAll(A);
  assert.equal(got.attempts.length, 2, "idempotent attempts"); assert.equal(got.captures.length, 1, "idempotent captures");
  assert.equal(got.captures[0].context, "my private note");
  assert.equal(got.town?.length, 3, "town events are stored once, idempotently"); assert.equal(got.town?.[0].ref, "market");
  assert.equal(got.prefs?.textScale, 1.25);

  await saveEvents(A, { captures: [], attempts: [] }, { explainLang: "en", textScale: 1, reducedMotion: false, audioFirst: true, simpleMode: true }, 50);   // older write loses
  assert.equal((await loadAll(A)).prefs?.explainLang, "hi", "last write wins: stale write ignored");
  await saveEvents(A, { captures: [], attempts: [] }, { explainLang: "en", textScale: 1, reducedMotion: false, audioFirst: true, simpleMode: true }, 200);
  assert.equal((await loadAll(A)).prefs?.explainLang, "en", "newer write applied");

  const other = await loadAll(B);
  assert.equal(other.attempts.length + other.captures.length, 0, "user B sees none of user A's data");

  got = await loadAll(A);
  const rebuilt = rebuildState(got);
  assert.equal(Object.keys(rebuilt.senses).length, 1); assert.equal(Object.keys(rebuilt.attempts).length, 2);
  assert.deepEqual(rebuilt.rewards.map(r => r.key).sort(), s.rewards.map(r => r.key).sort(), "rewards identical after round trip through the database");

  await deleteAll(A);
  const gone = await loadAll(A);
  assert.equal(gone.attempts.length + gone.captures.length + (gone.town?.length ?? 0), 0); assert.equal(gone.prefs, null);
  // meaning-agent failure cases: forms, phrases, typos (see docs/LOOKUP-FAILURES.md)
  const went = await lookupDict("went"); assert.equal(went?.matched, "go"); assert.equal(went?.senses[0].pos, "verb"); assert.match(went?.note ?? "", /form of/);
  assert.equal((await lookupDict("children"))?.matched, "child"); assert.equal((await lookupDict("hoping"))?.matched, "hope"); assert.equal((await lookupDict("gave up"))?.matched, "give up");
  const saw = await lookupDict("saw"); assert.ok(saw && saw.senses.some(x => x.lemma === "saw") && saw.senses.some(x => x.lemma === "see"), "an ambiguous form shows both readings");
  assert.equal(await lookupDict("asdfghjkl"), null);
  const cool = await lookupDict("cool"); assert.ok(cool && cool.senses.some(x => x.pos === "adjective"), "cool must offer its adjective meanings, not only nouns and verbs"); assert.ok(cool.senses.filter(x => x.pos === "noun").length <= 4);
  assert.ok((await suggestLemmas("recieve")).includes("receive")); assert.equal((await suggestLemmas("recieve"))[0], "receive"); assert.ok((await suggestLemmas("seperate")).includes("separate"));
  assert.deepEqual(await suggestLemmas("break the ice"), [], "no suggestions for phrases");
  console.log("db-check: all assertions passed");
} finally { await deleteAll(A); await deleteAll(B); }
