// Runs only on the Wordwild website. Hands the quick-saved words to the page, and forgets them once the page says it has them.
(function () {
  const post = async () => {
    try {
      const { queue = [] } = await chrome.storage.local.get("queue");
      window.postMessage({ source: "wordwild-extension", type: "queue", words: queue }, window.location.origin);
    } catch (e) { /* extension was updated: a page refresh reconnects */ }
  };
  window.addEventListener("message", async e => {
    if (e.source !== window || e.origin !== window.location.origin || !e.data || e.data.source !== "wordwild-page") return;
    if (e.data.type === "hello") post();
    if (e.data.type === "ack" && Array.isArray(e.data.ids)) {
      try { const { queue = [] } = await chrome.storage.local.get("queue"); const gone = new Set(e.data.ids); await chrome.storage.local.set({ queue: queue.filter(x => !gone.has(x.id)) }); } catch (err) { /* see above */ }
    }
  });
  try { chrome.storage.onChanged.addListener(c => { if (c.queue) post(); }); } catch (e) { /* see above */ }
  post();
})();
