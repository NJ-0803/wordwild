// Pure helpers shared by the content script, the toolbar popup and the tests. No browser APIs in here.
(function (root) {
  /**
   * A selection is lookup-worthy when it is 1-3 words. Surrounding punctuation, quotes, brackets, possessives and invisible
   * characters (all common when dragging a selection) are removed instead of making the shortcut silently do nothing.
   * The server decides what it knows and explains anything it cannot look up.
   */
  function cleanSelection(raw) {
    let t = String(raw || "").normalize("NFKC").replace(/[\u0000-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, " ").replace(/[\u2018\u2019\u02BC]/g, "'").replace(/\s+/g, " ").trim();
    if (!t || t.length > 40) return null;
    if (/^(https?:\/\/|www\.)/i.test(t) || /@/.test(t) || /\d/.test(t)) return null;    // addresses, e-mails and anything with digits: a selection the person did not mean as a word
    t = t.split(" ").map(w => w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "")).filter(Boolean).join(" ");
    t = t.replace(/'s$/i, "").replace(/'$/, "");
    if (!t || !/^[\p{L}][\p{L}' -]*$/u.test(t)) return null;
    if (t.split(" ").length > 3) return null;
    return t.toLowerCase();
  }

  /**
   * Should this keypress open the meaning? Any single printable character key works (like the Mac dictionary shortcut, but easier),
   * but never while someone is typing into a field, and never with Ctrl/Cmd/Alt (those are the site's and the browser's shortcuts).
   */
  function shouldTrigger(e, hasSelection, inEditable, mode) {
    if (!hasSelection || inEditable) return false;
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (mode === "off") return false;
    if (mode === "d") return e.key === "d" || e.key === "D";
    return typeof e.key === "string" && e.key.length === 1 && e.key !== " ";
  }

  /** Popup position: below the selection, kept inside the viewport, flipped above if there is no room. */
  function placePopup(rect, vw, vh, w, h) {
    const gap = 10; let left = rect.left + rect.width / 2 - w / 2; left = Math.max(8, Math.min(left, vw - w - 8));
    let top = rect.bottom + gap; if (top + h > vh - 8) top = Math.max(8, rect.top - h - gap);
    return { left: Math.round(left), top: Math.round(top) };
  }

  const api = { cleanSelection, shouldTrigger, placePopup };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.WordwildShared = api;
})(typeof self !== "undefined" ? self : this);
