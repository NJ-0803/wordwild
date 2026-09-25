// Runs the REAL background.js against the REAL dictionary API (dev server must be running). No browser needed.
import vm from "node:vm"; import fs from "node:fs"; import assert from "node:assert/strict";
let listener; const store = { sync: {} };
const ctx = { fetch, URL, encodeURIComponent, Map, console, chrome: { storage: { sync: { get: async () => ({ base: process.env.WW_BASE || "http://localhost:3100" }) } }, runtime: { onMessage: { addListener: fn => { listener = fn; } } } } };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(new URL("../background.js", import.meta.url), "utf8"), ctx);
const ask = msg => new Promise(res => { const keep = listener(msg, {}, res); assert.ok(keep === true || keep === false); });
const a = await ask({ type: "lookup", q: "skeptical" });
assert.equal(a.status, "found"); assert.ok(a.senses.length >= 1 && a.senses[0].simple && a.senses[0].lemma === "skeptical");
console.log("skeptical ->", a.senses.length, "meanings; first:", a.senses[0].simple.slice(0, 50), "| AI-enriched:", a.senses.some(s => s.ai));
const b = await ask({ type: "lookup", q: "parties" }); assert.equal(b.status, "found"); assert.equal(b.matched, "party"); console.log("parties -> matched", b.matched);
const c = await ask({ type: "lookup", q: "zzyzx" }); assert.equal(c.status, "unknown"); console.log("zzyzx ->", c.status);
const d = await ask({ type: "lookup", q: "<script>" }); assert.notEqual(d.status, "found"); console.log("<script> ->", d.status);
const e = await ask({ type: "base" }); assert.ok(e.base.startsWith("http")); console.log("base ->", e.base);
const t0 = Date.now(); await ask({ type: "lookup", q: "skeptical" }); assert.ok(Date.now() - t0 < 50, "second lookup comes from the cache"); console.log("cached repeat: ok");
console.log("live-lookup: all assertions passed");
