"use client";
import { useStore } from "@/lib/store";

/** Meanings in English or Hindi. Small enough to sit above a meaning; the same setting as in Settings. */
export function LangToggle() {
  const { state, update } = useStore(); const lang = state.prefs.explainLang;
  const set = (l: "hi" | "en") => update(s => ({ ...s, prefs: { ...s.prefs, explainLang: l } }));
  return (
    <div className="lang-tg" role="group" aria-label="Meanings in">
      <button aria-pressed={lang === "en"} onClick={() => set("en")}>English</button>
      <button aria-pressed={lang === "hi"} onClick={() => set("hi")} lang="hi">हिन्दी</button>
    </div>
  );
}
