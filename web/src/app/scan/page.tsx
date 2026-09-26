"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { capture, heuristicLevel, safeLookup, sentenceAround, unfamiliarWords, type Sense } from "@core";
import { Orb } from "@/components/Companion";
import { useStore } from "@/lib/store";
import { WebDictionary } from "@/lib/senses";
import { scanImage, type ScanResult, type ScanWord } from "@/lib/ocr";
import { useLearnerLevel } from "@/lib/useConstellation";
import { say } from "@/lib/speech";
import { Btn, Card, LinkBtn } from "@/components/ui";
import { SensePicker } from "@/components/SensePicker";

const provider = new WebDictionary();
type Look = { word: string; status: "loading" } | { word: string; status: "found"; senses: Sense[] } | { word: string; status: "unknown" | "error" };

export default function ScanPage() {
  const { state, update, now } = useStore();
  const router = useRouter(); const est = useLearnerLevel();
  const [phase, setPhase] = useState<"idle" | "working" | "done" | "error">("idle");
  const [prog, setProg] = useState({ label: "Getting ready", pct: 0 });
  const [res, setRes] = useState<ScanResult | null>(null);
  const [look, setLook] = useState<Look | null>(null); const [err, setErr] = useState("");
  const [levels, setLevels] = useState<Record<string, { level: number; source: string }>>({});
  const cam = useRef<HTMLInputElement>(null); const pick = useRef<HTMLInputElement>(null);

  const run = async (file?: File | null) => {
    if (!file) return;
    setPhase("working"); setRes(null); setLook(null); setErr("");
    try { setRes(await scanImage(file, (label, pct) => setProg({ label, pct }))); setPhase("done"); }
    catch { setErr("We could not read that photo. Try a clearer one, or type the word instead."); setPhase("error"); }
  };

  const open = async (word: string) => {
    setLook({ word, status: "loading" });
    const r = await safeLookup(provider, word, 8000);
    setLook(r.status === "found" ? { word, status: "found", senses: r.senses } : { word, status: r.status === "unknown" ? "unknown" : "error" });
  };
  const choose = (s: Sense, word: string) => {
    const context = res ? sentenceAround(res.lines, word) : "";
    update(st => capture(st, { status: "found", senses: [s], source: "camera" }, { source: "Camera", context, senseId: s.senseId, now: now() }).state);
    router.push(`/learn/${encodeURIComponent(s.senseId)}`);
  };

  const words = useMemo(() => res?.words ?? [], [res]);
  // Ask the server how hard each word is (cached AI judgement; a labelled heuristic if unavailable).
  useEffect(() => {
    if (!words.length) return;
    const list = [...new Set(words.filter(w => w.conf >= 55 && w.clean.length >= 4).map(w => w.clean))].slice(0, 40);
    let live = true;
    fetch("/api/levels", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ words: list }) })
      .then(r => (r.ok ? r.json() : null)).then(j => { if (live && j?.levels) setLevels(j.levels); }).catch(() => {});
    return () => { live = false; };
  }, [words]);
  const worthALook = useMemo(() => unfamiliarWords(words, est.level, w => levels[w]?.level ?? heuristicLevel(w, 2, false)), [words, est.level, levels]);
  const judged = Object.values(levels).some(l => l.source === "ai");
  const low = words.length > 0 && words.filter(w => w.conf >= 60).length / words.length < 0.5;

  return (
    <div className="stack">
      <Orb size={112} state={phase === "working" ? "searching" : "weaving"} label={phase === "working" ? "Reading the photo" : "Ready to scan"} />
      <h1>Scan a page</h1>
      <p className="sub">Take a photo of a book, a sign, a message or a film subtitle. Tap any word to see its meaning. <b>The photo stays on your device and is never uploaded.</b></p>
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={e => { void run(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={pick} type="file" accept="image/*" hidden data-testid="pick" onChange={e => { void run(e.target.files?.[0]); e.target.value = ""; }} />
      <div className="row"><Btn onClick={() => cam.current?.click()} icon="📷" disabled={phase === "working"}>Take a photo</Btn><Btn kind="soft" onClick={() => pick.current?.click()} icon="🖼️" disabled={phase === "working"}>Choose a photo</Btn></div>

      {phase === "working" && (
        <Card><div className="row" style={{ justifyContent: "flex-start", gap: 14 }} role="status">
          <span><b>{prog.label}…</b>{prog.pct > 0 && <> {prog.pct}%</>}<br /><span className="sub small">The first photo takes a little longer while the reader starts.</span></span>
        </div></Card>
      )}
      {phase === "error" && <Card tone="warn"><p role="alert">{err}</p><LinkBtn href="/capture" kind="soft">Type the word instead</LinkBtn></Card>}

      {phase === "done" && res && (<>
        {words.length === 0 ? <Card tone="warn"><p role="status"><b>We could not find any words.</b> Try more light, hold the phone steady, and fill the frame with the text.</p></Card> : (<>
          <p className="sub" style={{ margin: 0 }}>Tap a word in the photo{words.length ? ` (${words.length} found)` : ""}.</p>
          {low && <Card tone="warn"><span className="small">The photo is a bit blurry, so some words may be wrong. A clearer photo will read better.</span></Card>}
          <div className="scan" style={{ aspectRatio: `${res.width} / ${res.height}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={res.url} alt="Your photo" />
            {words.map((w: ScanWord, i) => (
              <button key={i} className={`scan-w${look?.word === w.clean ? " on" : ""}${w.conf < 60 ? " weak" : ""}`} aria-label={w.clean}
                style={{ left: `${w.x0 * 100}%`, top: `${w.y0 * 100}%`, width: `${(w.x1 - w.x0) * 100}%`, height: `${(w.y1 - w.y0) * 100}%` }} onClick={() => void open(w.clean)} />
            ))}
          </div>
          {worthALook.length > 0 && (
            <Card><p style={{ marginTop: 0 }}><b>Words worth a look</b> <span className="sub small">({judged ? "judged by AI for your reading level, and it can be wrong" : "a rough estimate from the shape of the word"})</span></p>
              <div className="chips">{worthALook.map(w => <button key={w} type="button" className="chip" onClick={() => void open(w)}>{w}</button>)}</div></Card>
          )}
          <details><summary className="sub">All the text we read</summary><p style={{ whiteSpace: "pre-wrap" }}>{res.lines.join("\n")}</p></details>
        </>)}
      </>)}

      {look && (
        <section aria-live="polite" className="stack">
          <h2>{look.word}</h2>
          {look.status === "loading" && <p className="sub" role="status">Looking it up…</p>}
          {look.status === "unknown" && <Card tone="warn"><p>We do not have &ldquo;{look.word}&rdquo; yet. It may have been misread. Nothing has been guessed.</p><LinkBtn href={`/capture?word=${encodeURIComponent(look.word)}`} kind="soft">Check the spelling</LinkBtn></Card>}
          {look.status === "error" && <Card tone="warn"><p>We could not look that up right now.</p><Btn kind="soft" onClick={() => void open(look.word)}>Try again</Btn></Card>}
          {look.status === "found" && <>
            <Btn kind="soft" icon="🔊" onClick={() => say(look.word)}>Say the word</Btn>
            <SensePicker senses={look.senses} lang={state.prefs.explainLang} onPick={s => choose(s, look.word)} /></>}
        </section>
      )}
      <LinkBtn href="/" kind="ghost">Back</LinkBtn>
    </div>
  );
}
