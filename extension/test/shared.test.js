const test = require("node:test"); const assert = require("node:assert/strict");
const { cleanSelection, shouldTrigger, placePopup } = require("../shared.js");

test("selection: one to three plain words only", () => {
  assert.equal(cleanSelection("  Skeptical "), "skeptical");
  assert.equal(cleanSelection("let\n go"), "let go");
  assert.equal(cleanSelection("don’t"), "don't");
  assert.equal(cleanSelection("well-known"), "well-known");
  for (const bad of ["", "   ", "12345", "https://a.com", "a b c d", "hello@x.com", "x".repeat(41), "1st", "What does this whole long sentence mean", "😀"]) assert.equal(cleanSelection(bad), null, JSON.stringify(bad));
  assert.equal(cleanSelection("<script>"), "script", "punctuation is cleaned; the server decides it is unknown");
  assert.equal(cleanSelection(null), null); assert.equal(cleanSelection(undefined), null);
  assert.equal(cleanSelection("मतलब"), "मतलब", "non-English letters are accepted here; the server explains that it looks up English");
  // dragging a selection often takes quotes, commas, brackets, possessives and invisible characters along
  for (const [raw, want] of [["“skeptical,”", "skeptical"], ["(euphemism).", "euphemism"], ["Nani’s", "nani"], ["seren\u200Bdipity", "seren dipity"], ["skeptical—", "skeptical"], ["…meticulous", "meticulous"], ["\"give up\"", "give up"]]) assert.equal(cleanSelection(raw), want, JSON.stringify(raw));
});
test("trigger: any letter key with a selection, never in fields, never with Ctrl/Cmd/Alt", () => {
  const key = (k, extra = {}) => ({ key: k, ctrlKey: false, metaKey: false, altKey: false, ...extra });
  assert.equal(shouldTrigger(key("a"), true, false, "any"), true);
  assert.equal(shouldTrigger(key("Z", { shiftKey: true }), true, false, "any"), true);
  assert.equal(shouldTrigger(key("a"), false, false, "any"), false, "no selection");
  assert.equal(shouldTrigger(key("a"), true, true, "any"), false, "typing in a field");
  for (const m of ["ctrlKey", "metaKey", "altKey"]) assert.equal(shouldTrigger(key("c", { [m]: true }), true, false, "any"), false, m + " belongs to the browser or site");
  for (const k of ["Enter", "Escape", "ArrowDown", "Tab", "Shift", " ", "F5"]) assert.equal(shouldTrigger(key(k), true, false, "any"), false, k);
  assert.equal(shouldTrigger(key("d"), true, false, "d"), true); assert.equal(shouldTrigger(key("a"), true, false, "d"), false);
  assert.equal(shouldTrigger(key("a"), true, false, "off"), false);
});
test("popup placement stays inside the window and flips above when needed", () => {
  const below = placePopup({ left: 400, top: 100, bottom: 120, width: 60 }, 1000, 800, 320, 200);
  assert.ok(below.top > 120 && below.left >= 8 && below.left + 320 <= 992);
  const nearRight = placePopup({ left: 980, top: 100, bottom: 120, width: 10 }, 1000, 800, 320, 200); assert.ok(nearRight.left + 320 <= 992);
  const nearLeft = placePopup({ left: 0, top: 100, bottom: 120, width: 4 }, 1000, 800, 320, 200); assert.ok(nearLeft.left >= 8);
  const flipped = placePopup({ left: 400, top: 700, bottom: 720, width: 60 }, 1000, 800, 320, 200); assert.ok(flipped.top + 200 <= 700, "sits above the word");
});
