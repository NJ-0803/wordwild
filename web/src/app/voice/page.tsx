"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { capture, type Sense } from "@core";
import { useStore } from "@/lib/store";
import { cacheSenses } from "@/lib/senses";
import { say } from "@/lib/speech";
import { Btn, Card, LinkBtn } from "@/components/ui";
import { SensePicker } from "@/components/SensePicker";
import { Orb } from "@/components/Companion";

type Found = { status: "found"; transcript: string; word: string; senses: Sense[]; suggested: number | null };
type Result = Found | { status: "no-word" | "silent" } & { transcript?: string } | { status: "unknown"; transcript: string; word: string; suggestions?: string[] };
type Phase = "idle" | "recording" | "thinking";
const MAX_MS = 12_000;
const pickMime = () => ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find(m => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";

export default function VoicePage() {
  const { state, update, now } = useStore();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const rec = useRef<MediaRecorder | null>(null); const chunks = useRef<Blob[]>([]); const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const stream = useRef<MediaStream | null>(null);

  useEffect(() => { try { setConsent(localStorage.getItem("wordwild.voiceOk") === "1"); } catch {} }, []);       // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => () => { clearTimeout(timer.current); stream.current?.getTracks().forEach(t => t.stop()); }, []);

  const agree = () => { setConsent(true); try { localStorage.setItem("wordwild.voiceOk", "1"); } catch {} };

  const send = async (blob: Blob, mime: string) => {
    setPhase("thinking");
    try {
      const fd = new FormData(); fd.append("audio", blob, `speech.${mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : "webm"}`);
      const r = await fetch("/api/voice", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({})) as Result & { error?: string };
      if (!r.ok) setErr(r.status === 401 ? "Please sign in to ask by voice." : r.status === 429 ? "You have used today's voice questions. Try again tomorrow, or type the word." : r.status === 503 ? "The voice helper is busy or not switched on. Nothing was used up. You can type the word instead." : "That did not work. Please try again or type the word.");
      else {
        setResult(j);
        if (j.status === "found") { cacheSenses(j.senses); const first = j.senses[j.suggested ?? 0]; if (j.senses.length === 1 || j.suggested !== null) say(`${first.lemma}. ${first.simple}`, state.prefs.explainLang === "hi" && first.explanations.hi ? "hi" : "en"); }
        else say(j.status === "unknown" ? "I could not find that word." : "I did not catch a word. Please try again.");
      }
    } catch { setErr("You seem to be offline. Try again when you are connected."); }
    setPhase("idle");
  };

  const start = async () => {
    setErr(null); setResult(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setErr("This browser cannot record. Please type the word instead."); return; }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch { setErr("We could not use the microphone. You may have said no. You can allow it in the browser, or type the word."); return; }
    const mime = pickMime(); chunks.current = [];
    const mr = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined); rec.current = mr;
    mr.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data); };
    mr.onstop = () => { stream.current?.getTracks().forEach(t => t.stop()); const type = mr.mimeType || mime || "audio/webm"; void send(new Blob(chunks.current, { type }), type); };
    mr.start(); setPhase("recording");
    timer.current = setTimeout(() => stop(), MAX_MS);
  };
  const stop = () => { clearTimeout(timer.current); if (rec.current && rec.current.state !== "inactive") rec.current.stop(); };

  const choose = (s: Sense) => {
    update(st => capture(st, { status: "found", senses: [s], source: "voice" }, { source: "Voice", context: result && "transcript" in result && result.transcript ? result.transcript : "", senseId: s.senseId, now: now() }).state);
    router.push(`/learn/${encodeURIComponent(s.senseId)}`);
  };

  return (
    <div className="stack">
      <h1>Ask by voice</h1>
      <p className="sub">Say the word you did not understand, in English or Hindi. For example: &ldquo;What does skeptical mean?&rdquo; You can also say the sentence you heard it in.</p>
      {!isSignedIn && <Card tone="warn"><p>Voice needs you to sign in.</p><LinkBtn href="/sign-in">Sign in</LinkBtn></Card>}
      {isSignedIn && !consent && (
        <Card><p><b>Before you speak</b></p><p className="small">Your voice is sent to a speech service to turn it into text. We do not keep the recording. You can always type instead.</p><Btn onClick={agree}>OK, I understand</Btn></Card>
      )}
      {isSignedIn && consent && (
        <div className="stack" style={{ alignItems: "center", textAlign: "center" }}>
          <div aria-live="polite"><Orb size={176} state={phase === "recording" ? "listening" : phase === "thinking" ? "solving" : "weaving"} label={phase === "recording" ? "Listening" : phase === "thinking" ? "Working out the word" : "Ready to listen"} /></div>
          {phase === "idle" && <Btn onClick={start} icon="🎤">Tap and speak</Btn>}
          {phase === "recording" && <Btn onClick={stop} icon="⏹">Done speaking</Btn>}
          {phase === "thinking" && <p role="status" className="sub">Listening to what you said…</p>}
        </div>
      )}
      {err && <Card tone="warn"><p role="alert">{err}</p><LinkBtn href="/capture" kind="soft">Type the word instead</LinkBtn></Card>}
      {result && "transcript" in result && result.transcript && <Card><p className="sub small" style={{ margin: 0 }}>We heard:</p><p style={{ margin: 0 }}><b>&ldquo;{result.transcript}&rdquo;</b></p></Card>}
      {result?.status === "found" && <SensePicker senses={result.senses} lang={state.prefs.explainLang} suggested={result.suggested} onPick={choose} />}
      {result?.status === "unknown" && <Card tone="warn"><p>We do not have &ldquo;{result.word}&rdquo; in our dictionary. Nothing has been guessed.</p>{result.suggestions && result.suggestions.length > 0 && <p>Did you mean: {result.suggestions.map((x, i) => <span key={x}>{i > 0 && ", "}<a href={`/capture?word=${encodeURIComponent(x)}`}>{x}</a></span>)}?</p>}<LinkBtn href="/capture" kind="soft">Type it to check the spelling</LinkBtn></Card>}
      {(result?.status === "no-word" || result?.status === "silent") && <Card tone="warn"><p>We did not catch a word. Please try again, and say the word clearly.</p></Card>}
      <LinkBtn href="/" kind="ghost">Back</LinkBtn>
    </div>
  );
}
