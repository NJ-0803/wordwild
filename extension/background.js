// Service worker: does the network calls (extension pages are not blocked by the website's CORS rules) and remembers recent lookups.
const DEFAULT_BASE = "https://wordwild-seven.vercel.app";
const cache = new Map();

async function baseUrl() { const { base } = await chrome.storage.sync.get("base"); return (base || DEFAULT_BASE).replace(/\/+$/, ""); }

async function lookup(q) {
  const key = q.toLowerCase(); if (cache.has(key)) return cache.get(key);
  const base = await baseUrl();
  const res = await fetch(`${base}/api/dict?q=${encodeURIComponent(q)}`, { headers: { accept: "application/json" } });
  if (res.status === 429) return { status: "busy" };
  if (!res.ok) return { status: "error" };
  const data = await res.json();
  if (data.status === "unsearchable") return { status: "unsearchable", message: data.message || "That cannot be looked up." };   // not cached: it is a property of the input, cheap to recompute
  const out = data.status === "found" ? { status: "found", matched: data.matched, senses: data.senses.slice(0, 10).map(s => ({ id: s.senseId, lemma: s.lemma, pos: s.pos, simple: s.simple, definition: s.definition, example: s.examples?.[0]?.text || "", hi: s.explanations?.hi || "", ai: s.provenance?.tier === "enriched", note: data.notes?.[s.senseId] || "" })) } : { status: data.status || "unknown", suggestions: (data.suggestions || []).slice(0, 4), hint: data.note || "" };
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  cache.set(key, out); return out;
}

/** Quick save: keep the word on this device until the person next opens the website, which then adds it to their words. Nothing is sent anywhere. */
async function quickSave(item) {
  const id = String(item.id || "").slice(0, 80), lemma = String(item.lemma || "").slice(0, 40);
  if (!id || !lemma) return { ok: false };
  const { queue = [] } = await chrome.storage.local.get("queue");
  if (!queue.some(x => x.id === id)) queue.push({ id, lemma, at: Date.now() });
  await chrome.storage.local.set({ queue: queue.slice(-100) });
  return { ok: true, count: queue.length };
}

chrome.runtime.onMessage.addListener((msg, _sender, send) => {
  if (msg?.type === "lookup" && typeof msg.q === "string") { lookup(msg.q.slice(0, 40)).then(send).catch(() => send({ status: "error" })); return true; }
  if (msg?.type === "quicksave" && msg.item) { quickSave(msg.item).then(send).catch(() => send({ ok: false })); return true; }
  if (msg?.type === "base") { baseUrl().then(b => send({ base: b })); return true; }
  return false;
});
