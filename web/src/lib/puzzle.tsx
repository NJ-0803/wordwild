"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatTime } from "@core";
import { usePersisted } from "./usePersisted";

/** Stopwatch for a puzzle. It starts on the first move, stops when the puzzle is finished, and survives a refresh. */
export function useStopwatch(key: string) {
  const [s, set] = usePersisted<{ at: number | null; final: number | null }>(key, { at: null, final: null });
  const [, tick] = useState(0);
  useEffect(() => { if (s.at === null || s.final !== null) return; const t = setInterval(() => tick(n => n + 1), 500); return () => clearInterval(t); }, [s.at, s.final]);
  const start = useCallback(() => set(v => (v.at === null ? { at: Date.now(), final: null } : v)), [set]);
  const stop = useCallback((): number => { let ms = 0; set(v => { ms = v.final ?? (v.at ? Date.now() - v.at : 0); return v.final !== null ? v : { at: v.at ?? Date.now(), final: ms }; }); return ms; }, [set]);
  const ms = s.final !== null ? s.final : s.at !== null ? Date.now() - s.at : 0;    // eslint-disable-line react-hooks/purity -- a clock is impure by nature
  return { ms, running: s.at !== null && s.final === null, done: s.final !== null, start, stop };
}
export function Stopwatch({ ms, running }: { ms: number; running: boolean }) {
  return <span className="pz-timer" role="timer" aria-label={`Time ${formatTime(ms)}`}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 3h6" /></svg>{formatTime(ms)}{running ? "" : ""}</span>;
}

/** A correct answer shakes the whole puzzle like a small earthquake and sends a ring outward. Reduced motion gets a soft flash instead. */
export function useQuake() {
  const [n, setN] = useState(0);
  const trigger = useCallback((big = false) => setN(x => x + (big ? 1000 : 1)), []);
  return { cls: n ? (n >= 1000 ? "quake big" : "quake") : "", key: n, trigger, wave: n ? <span key={n} className="pz-wave" aria-hidden /> : null };
}

interface Rec { start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null; lang: string; maxAlternatives: number; interimResults: boolean }
/** Say the word instead of picking letters. Uses the browser's own speech recognition (Chrome and Safari); where it is missing, `supported` is false. */
export function useSpeech(onHeard: (alternatives: string[]) => void) {
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState("");
  const recRef = useRef<Rec | null>(null);
  const cb = useRef(onHeard); useEffect(() => { cb.current = onHeard; }, [onHeard]);
  const SR = typeof window !== "undefined" ? ((window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition) : undefined;
  const [supported, setSupported] = useState(false);
  useEffect(() => { setSupported(!!SR); }, [SR]);                     // eslint-disable-line react-hooks/set-state-in-effect
  const listen = useCallback(() => {
    if (!SR || listening) return;
    setNote("");
    const r = new SR(); r.lang = "en-US"; r.maxAlternatives = 5; r.interimResults = false;
    r.onresult = e => { const alts = Array.from(e.results[0] ?? []).map(a => a.transcript); if (alts.length) cb.current(alts); };
    r.onerror = e => { setNote(e.error === "not-allowed" ? "Microphone is blocked. Allow it in the address bar." : e.error === "no-speech" ? "I did not hear anything. Try again." : "Could not listen. Try again."); };
    r.onend = () => setListening(false);
    recRef.current = r; setListening(true);
    try { r.start(); } catch { setListening(false); }
  }, [SR, listening]);
  useEffect(() => () => { try { recRef.current?.stop(); } catch { /* already stopped */ } }, []);
  return { supported, listening, note, listen };
}
export function MicButton({ listening, onClick, label = "Say the word" }: { listening: boolean; onClick: () => void; label?: string }) {
  return <button type="button" className={`pz-mic${listening ? " on" : ""}`} onClick={onClick} aria-pressed={listening}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0M12 17v4" /></svg>{listening ? "Listening…" : label}</button>;
}

export const spokenWordLetters = (t: string) => String(t ?? "").toLowerCase().replace(/[^a-z]/g, "");
