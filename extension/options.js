const $ = id => document.getElementById(id);
// The store version cannot point at other servers (no extra permissions), so the address box is only shown in the developer build.
if (!(chrome.runtime.getManifest().optional_host_permissions || []).length && $("addr")) $("addr").hidden = true;
chrome.storage.sync.get(["trigger", "base"]).then(v => { $("trigger").value = v.trigger || "any"; $("base").value = v.base || "https://wordwild-seven.vercel.app"; });
$("save").onclick = async () => {
  let base = $("base").value.trim().replace(/\/+$/, ""); const msg = $("msg");
  try { const u = new URL(base); if (!/^https?:$/.test(u.protocol)) throw 0; base = u.origin; } catch { msg.textContent = "Please enter a full address such as https://example.com"; return; }
  if (!base.startsWith("http://localhost")) { const ok = await chrome.permissions.request({ origins: [base + "/*"] }); if (!ok) { msg.textContent = "Permission to reach that address was not given."; return; } }
  await chrome.storage.sync.set({ trigger: $("trigger").value, base }); msg.textContent = "Saved.";
};
