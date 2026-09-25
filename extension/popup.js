const $ = id => document.getElementById(id); const S = self.WordwildShared;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
async function go() {
  const q = (S?.cleanSelection ? S.cleanSelection($("q").value) : $("q").value.trim().toLowerCase()); const out = $("out");
  if (!q) { out.textContent = "Please type one to three words, using letters only."; return; }
  out.textContent = "Looking up…"; $("orb").classList.add("busy");
  const res = await chrome.runtime.sendMessage({ type: "lookup", q }).catch(() => ({ status: "error" }));
  const { base } = await chrome.runtime.sendMessage({ type: "base" });
  $("orb").classList.remove("busy");
  if (res.status === "found") { const s = res.senses[0]; out.innerHTML = `<div class="beam"><div class="card"><p class="w">${esc(s.lemma)}</p><p class="s">${esc(s.pos)}${res.senses.length > 1 ? ` · ${res.senses.length} meanings` : ""}</p><p>${esc(s.simple)}</p>${s.hi ? `<p lang="hi">${esc(s.hi)}</p>` : ""}<p><a target="_blank" rel="noopener" href="${esc(base)}/capture?word=${encodeURIComponent(res.matched || s.lemma)}">See all meanings and save</a></p></div></div>`; }
  else if (res.status === "unsearchable") out.textContent = res.message;
  else if (res.status === "unknown") { out.innerHTML = `<p>Not in our dictionary yet.</p>${(res.suggestions || []).length ? `<p class="s">Did you mean: ${res.suggestions.map(x => `<a href="#" data-sug="${esc(x)}">${esc(x)}</a>`).join(", ")}</p>` : ""}`; out.querySelectorAll("[data-sug]").forEach(a => a.addEventListener("click", e => { e.preventDefault(); $("q").value = a.dataset.sug; go(); })); }
  else out.textContent = "Could not reach Wordwild right now.";
}
$("go").onclick = go; $("q").addEventListener("keydown", e => { if (e.key === "Enter") go(); }); $("q").focus();
