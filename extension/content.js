// Select a word on any page, press a key, see the meaning. Only the selected word (never the page, URL or your other text) is sent.
(() => {
  const S = self.WordwildShared; let mode = "any"; let host, shadow, card, wrap, state = null;
  chrome.storage.sync.get(["trigger"]).then(v => { mode = v.trigger || "any"; });
  chrome.storage.onChanged.addListener(c => { if (c.trigger) mode = c.trigger.newValue || "any"; });

  const inEditable = el => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  const speak = (t) => { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.rate = 0.9; speechSynthesis.speak(u); } catch {} };

  function ensure() {
    if (host) return;
    host = document.createElement("div"); host.style.cssText = "all:initial;position:fixed;z-index:2147483647;left:0;top:0;";
    shadow = host.attachShadow({ mode: "closed" });
    shadow.innerHTML = `<style>
      *{box-sizing:border-box}
      .beam{position:fixed;padding:2px;border-radius:20px;overflow:hidden;background:#2a3b73;width:324px;max-width:calc(100vw - 8px);box-shadow:0 24px 70px rgba(0,0,0,.75),0 0 40px rgba(50,90,220,.35);animation:open .42s cubic-bezier(.34,1.45,.64,1) both}
      .beam::before{content:"";position:absolute;left:50%;top:50%;width:260%;aspect-ratio:1;translate:-50% -50%;background:conic-gradient(from 0deg,transparent 0 55%,rgba(80,120,255,.95) 78%,#dfe7ff 90%,transparent 100%);animation:spin 3.6s linear infinite}
      .c{position:relative;font:15px/1.45 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:#f3f5fb;background:linear-gradient(180deg,#0b1636,#05070f 45%);border-radius:18px;padding:16px 18px;outline:none}
      .w{font:400 30px/1.05 "Instrument Serif",Georgia,"Times New Roman",serif;letter-spacing:-.01em;color:#fff;margin:0}
      .p{font:500 11px/1.4 "IBM Plex Mono",ui-monospace,Menlo,monospace;text-transform:uppercase;letter-spacing:.07em;color:#a4aec6;margin:4px 0 8px}
      .m{margin:6px 0;font-size:16px}.e{color:#a4aec6;font-size:13px;margin:6px 0}.h{margin:6px 0;font-size:15px}
      .b{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
      button,a.btn{font:inherit;font-weight:600;min-height:40px;padding:6px 14px;border-radius:12px;border:1px solid #2b4fa8;background:linear-gradient(180deg,#14306f,#0c1d47);color:#fff;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;transition:transform .3s cubic-bezier(.34,1.45,.64,1),filter .2s}
      button:hover,a.btn:hover{filter:brightness(1.25)}button:active,a.btn:active{transform:scale(.95)}
      button.g,a.btn.g{background:rgba(4,5,10,.7);border-color:#2a3b73}
      button:focus-visible,a:focus-visible,.c:focus-visible{outline:3px solid #6f93ff;outline-offset:2px}
      .x{position:absolute;right:8px;top:6px;min-height:32px;padding:0 10px;border-color:transparent;background:transparent;color:#a4aec6;font-size:18px}
      .n{color:#a4aec6;font-size:12px;margin-top:10px}.ai{font-size:11px;color:#9db4ff}
      .orb{width:34px;height:34px;border-radius:50%;margin:0 0 8px;background:radial-gradient(circle at 35% 30%,#dfe7ff 0 6%,#6f93ff 22%,#14306f 62%,#04050a 100%);box-shadow:0 0 22px rgba(80,120,255,.7);animation:breathe 1.2s ease-in-out infinite}
      @keyframes spin{to{rotate:360deg}}@keyframes breathe{50%{transform:scale(1.12);filter:brightness(1.3)}}
      @keyframes open{from{opacity:0;transform:translateY(10px) scale(.96)}to{opacity:1;transform:none}}
      @media (prefers-reduced-motion:reduce){.beam,.orb{animation:none}.beam::before{animation:none;background:rgba(111,147,255,.7);width:100%}button,a.btn{transition:none}}
    </style><div class="beam"><div class="c" role="dialog" aria-label="Word meaning" tabindex="-1"></div></div>`;
    card = shadow.querySelector(".c"); wrap = shadow.querySelector(".beam"); document.documentElement.appendChild(host);
  }
  function close() { if (host) { host.remove(); host = null; } state = null; try { speechSynthesis.cancel(); } catch {} }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  async function render() {
    if (!state) return; ensure();
    const { q, res, i, base, rect } = state; let html = `<button class="x" aria-label="Close">×</button>`;
    if (!res) html += `<div class="orb" role="img" aria-label="Looking up"></div><p class="p">Looking up</p><p class="w">${esc(q)}</p>`;
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
    const pos = S.placePopup(rect, innerWidth, innerHeight, 324, wrap.offsetHeight || 190); wrap.style.left = pos.left + "px"; wrap.style.top = pos.top + "px";
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
