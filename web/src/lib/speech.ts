import type { Lang } from "@core";

const tag: Record<Lang, string> = { en: "en-IN", hi: "hi-IN", pa: "pa-IN" };
type Listener = (speaking: boolean) => void;
const listeners = new Set<Listener>();
const emit = (v: boolean) => listeners.forEach(l => l(v));
export const onSpeaking = (l: Listener) => { listeners.add(l); return () => { listeners.delete(l); }; };

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Browser TTS. Voices vary by device; if none matches the language we still speak with the default and the text stays visible. */
export function say(text: string, lang: Lang = "en") {
  if (!canSpeak()) return;
  const s = window.speechSynthesis;
  s.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = tag[lang]; u.rate = 0.9;
  const v = s.getVoices().find(x => x.lang.toLowerCase().startsWith(tag[lang].slice(0, 2)));
  if (v) u.voice = v;
  u.onstart = () => emit(true); u.onend = () => emit(false); u.onerror = () => emit(false);
  s.speak(u);
}
export const stopSpeaking = () => { if (canSpeak()) { window.speechSynthesis.cancel(); emit(false); } };
export const hasVoice = (lang: Lang) => canSpeak() && window.speechSynthesis.getVoices().some(v => v.lang.toLowerCase().startsWith(tag[lang].slice(0, 2)));
