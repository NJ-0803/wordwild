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
  const out = data.status === "found" ? { status: "found", matched: data.matched, senses: data.senses.slice(0, 6).map(s => ({ id: s.senseId, lemma: s.lemma, pos: s.pos, simple: s.simple, definition: s.definition, example: s.examples?.[0]?.text || "", hi: s.explanations?.hi || "", ai: s.provenance?.tier === "enriched" })) } : { status: data.status || "unknown" };
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  cache.set(key, out); return out;
}

chrome.runtime.onMessage.addListener((msg, _sender, send) => {
  if (msg?.type === "lookup" && typeof msg.q === "string") { lookup(msg.q.slice(0, 40)).then(send).catch(() => send({ status: "error" })); return true; }
  if (msg?.type === "base") { baseUrl().then(b => send({ base: b })); return true; }
  return false;
});
