// Select a word on any page, press a key, see the meaning. Only the selected word (never the page, URL or your other text) is sent.
(() => {
  const S = self.WordwildShared; let mode = "any"; let host, shadow, card, state = null;
  chrome.storage.sync.get(["trigger"]).then(v => { mode = v.trigger || "any"; });
  chrome.storage.onChanged.addListener(c => { if (c.trigger) mode = c.trigger.newValue || "any"; });

  const inEditable = el => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  const speak = (t) => { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.rate = 0.9; speechSynthesis.speak(u); } catch {} };

  function ensure() {
    if (host) return;
    host = document.createElement("div"); host.style.cssText = "all:initial;position:fixed;z-index:2147483647;left:0;top:0;";
    shadow = host.attachShadow({ mode: "closed" });
    shadow.innerHTML = `<style>
      .c{font:15px/1.45 system-ui,-apple-system,sans-serif;color:#f2efe8;background:#1e2427;border:1px solid #3a4348;border-radius:14px;box-shadow:0 10px 34px rgba(0,0,0,.4);width:320px;max-width:calc(100vw - 16px);padding:14px 16px;position:fixed}
      .w{font-size:22px;font-weight:800;color:#56c9a8;margin:0}.p{color:#b9c0c4;font-size:13px;margin:0 0 6px}
      .m{margin:6px 0;font-size:16px}.e{color:#b9c0c4;font-size:13px;margin:6px 0}.h{margin:6px 0;font-size:15px}
      .b{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
      button,a.btn{font:inherit;font-weight:700;min-height:40px;padding:6px 12px;border-radius:10px;border:2px solid #56c9a8;background:#56c9a8;color:#0b1f19;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
      button.g{background:transparent;color:#56c9a8}.x{position:absolute;right:8px;top:6px;min-height:32px;padding:0 10px;border-color:transparent;background:transparent;color:#b9c0c4;font-size:18px}
      .n{color:#b9c0c4;font-size:12px;margin-top:8px}.ai{font-size:11px;color:#ffd166}
    </style><div class="c" role="dialog" aria-label="Word meaning" tabindex="-1"></div>`;
    card = shadow.querySelector(".c"); document.documentElement.appendChild(host);
  }
  function close() { if (host) { host.remove(); host = null; } state = null; try { speechSynthesis.cancel(); } catch {} }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  async function render() {
    if (!state) return; ensure();
    const { q, res, i, base, rect } = state; let html = `<button class="x" aria-label="Close">×</button>`;
    if (!res) html += `<p class="p">Looking up</p><p class="w">${esc(q)}</p>`;
    else if (res.status === "found") {
      const s = res.senses[i];
      html += `<p class="w">${esc(s.lemma)}</p><p class="p">${esc(s.pos)}${res.senses.length > 1 ? ` · meaning ${i + 1} of ${res.senses.length}` : ""}</p><p class="m">${esc(s.simple)}</p>`;
      if (s.hi) html += `<p class="h" lang="hi">${esc(s.hi)}</p>`;
      if (s.example) html += `<p class="e">“${esc(s.example)}”</p>`;
      html += `<div class="b"><button data-a="say">🔊 Listen</button>${res.senses.length > 1 ? `<button class="g" data-a="next">Next meaning</button>` : ""}<a class="btn g" target="_blank" rel="noopener" href="${esc(base)}/capture?word=${encodeURIComponent(res.matched || s.lemma)}">Save to Wordwild</a></div>`;
      html += `<p class="n">Only the word you selected was sent.${s.ai ? ' <span class="ai">Extra help drafted by AI.</span>' : ""}</p>`;
    } else if (res.status === "busy") html += `<p class="m">Please wait a moment and try again.</p>`;
    else if (res.status === "error") html += `<p class="m">Could not reach Wordwild. Is your connection on, and the address set in the extension options?</p>`;
    else html += `<p class="w">${esc(q)}</p><p class="m">Not in our dictionary yet. Nothing has been guessed.</p>`;
    card.innerHTML = html;
    const pos = S.placePopup(rect, innerWidth, innerHeight, 320, card.offsetHeight || 180); card.style.left = pos.left + "px"; card.style.top = pos.top + "px";
    card.querySelector(".x").onclick = close;
    card.querySelector('[data-a="say"]')?.addEventListener("click", () => speak(`${res.senses[i].lemma}. ${res.senses[i].simple}`));
    card.querySelector('[data-a="next"]')?.addEventListener("click", () => { state.i = (state.i + 1) % res.senses.length; render(); });
    card.focus({ preventScroll: true });
  }

  async function open(word, rect) {
    const { base } = await chrome.runtime.sendMessage({ type: "base" });
    state = { q: word, res: null, i: 0, base, rect }; render();
    const res = await chrome.runtime.sendMessage({ type: "lookup", q: word }).catch(() => ({ status: "error" }));
    if (state && state.q === word) { state.res = res; render(); }
  }

  addEventListener("keydown", e => {
    if (e.key === "Escape" && host) { close(); return; }
    const sel = getSelection(); const word = S.cleanSelection(sel && sel.toString());
    if (!S.shouldTrigger(e, !!word, inEditable(document.activeElement), mode)) return;
    const range = sel.rangeCount ? sel.getRangeAt(0) : null; if (!range) return;
    e.preventDefault(); e.stopPropagation();          // the pressed key opens the meaning; it does not also act on the page
    open(word, range.getBoundingClientRect());
  }, true);
  addEventListener("mousedown", e => { if (host && e.target !== host) close(); }, true);
  addEventListener("scroll", () => { if (host) close(); }, { passive: true, capture: true });
})();
