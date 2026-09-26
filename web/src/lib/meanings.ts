/** Plain meanings from the dictionary for a few words at once (the same endpoint the sentence hover uses). Unknown words are left out. */
export interface Meaning { word: string; lemma: string; pos: string; simple: string }
export async function fetchMeanings(words: string[]): Promise<Map<string, Meaning>> {
  const out = new Map<string, Meaning>();
  try {
    const r = await fetch("/api/words", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ words: words.slice(0, 10) }) });
    if (!r.ok) return out;
    for (const m of ((await r.json()) as { items: Meaning[] }).items) out.set(m.word, m);
  } catch { /* offline: callers cope with a missing meaning */ }
  return out;
}
/** Does the dictionary know this word? `null` means we could not tell (offline), so the caller should not block the player. */
export async function knownWord(word: string): Promise<boolean | null> {
  try {
    const r = await fetch("/api/words", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ words: [word] }) });
    if (!r.ok) return null;
    return ((await r.json()) as { items: unknown[] }).items.length > 0;
  } catch { return null; }
}
/** Hide the answer if the meaning happens to spell it out. */
export const mask = (text: string, word: string) => text.replace(new RegExp(`\\b${word.replace(/[^a-z]/gi, "")}\\w*`, "gi"), "____");
