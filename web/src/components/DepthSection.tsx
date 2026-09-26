"use client";
import { Icon } from "./Icons";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import type { Depth } from "@core";
import { Btn, Card, LinkBtn } from "./ui";
import { Reward } from "./Companion";
import { ThinkingOrb } from "thinking-orbs";
import { useReducedMotion } from "@/lib/motion";
import { say } from "@/lib/speech";

const TONE: Record<Depth["feel"]["tone"], string> = { positive: "Feels positive", neutral: "Feels neutral", negative: "Feels negative", mixed: "Feels mixed" };
const TONE_COLOR: Record<Depth["feel"]["tone"], string> = { positive: "#a9d4ff", neutral: "#6f93ff", negative: "#b9a4ff", mixed: "#dbe6ff" };

async function call(senseId: string, onlyCached: boolean): Promise<{ depth?: Depth; status: number; error?: string }> {
  const r = await fetch("/api/depth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ senseId, onlyCached }) });
  const j = await r.json().catch(() => ({})) as { depth?: Depth; error?: string };
  return { depth: j.depth, status: r.status, error: j.error };
}

/** What the dictionary line does not tell you: how the word feels, where it sits on a scale, and where a close word will NOT do. */
export function DepthSection({ senseId, lemma }: { senseId: string; lemma: string }) {
  const { isSignedIn } = useAuth();
  const reduced = useReducedMotion();
  const [depth, setDepth] = useState<Depth | null>(null);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => { let live = true; call(senseId, true).then(r => { if (live) { if (r.depth) setDepth(r.depth); setChecked(true); } }).catch(() => { if (live) setChecked(true); }); return () => { live = false; }; }, [senseId]);

  const make = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await call(senseId, false);
      if (r.depth) setDepth(r.depth);
      else setMsg(r.status === 401 ? "Sign in to unlock the deeper meaning." : r.status === 503 && r.error === "busy" ? "The word helper is busy. Nothing was used up. Please try again in a minute." : r.status === 429 ? "You have reached today's limit. Try again tomorrow." : r.error === "rejected" ? "We could not make a trustworthy deeper meaning for this word, so we are not showing one." : "This part is not available right now.");
    } catch { setMsg("You seem to be offline. Try again when you are connected."); }
    setBusy(false);
  };

  if (!depth) {
    if (!checked) return null;
    return (
      <Card>
        <h2 style={{ marginBottom: 6 }}>Go deeper</h2>
        <p className="sub small">How &ldquo;{lemma}&rdquo; feels, where it sits between milder and stronger words, and where a close word will not do.</p>
        {isSignedIn ? <Btn onClick={make} disabled={busy}>{busy ? "Working it out… (about 10 seconds)" : "Show the deeper meaning"}</Btn> : <LinkBtn href="/sign-in" kind="soft">Sign in to see the deeper meaning</LinkBtn>}
        {busy && <div role="status" style={{ marginTop: 8 }}><ThinkingOrb state="solving" size={64} paused={reduced} /></div>}
        {msg && <p role="alert"><b>{msg}</b></p>}
      </Card>
    );
  }
  return (
    <section aria-labelledby="deep-h" className="stack">
      <h2 id="deep-h" style={{ fontSize: "1.4rem" }}>Go deeper</h2>
      <Card>
        <span className="role" style={{ background: TONE_COLOR[depth.feel.tone] }}>{TONE[depth.feel.tone]}</span>
        <p style={{ margin: "8px 0 0" }}>{depth.feel.note}</p>
        <Btn kind="soft" icon={<Icon.Speaker />} onClick={() => say(depth.feel.note)} style={{ marginTop: 8 }}>Listen</Btn>
      </Card>
      {depth.ladder.length > 0 && (
        <Card>
          <p style={{ marginTop: 0 }}><b>From milder to stronger</b></p>
          <ol className="ladder" aria-label="Words from milder to stronger">
            {depth.ladder.map(w => <li key={w} className={w === lemma ? "on" : ""} aria-current={w === lemma ? "true" : undefined}>{w}</li>)}
          </ol>
          <div className="row small sub" style={{ justifyContent: "space-between" }}><span>milder</span><span style={{ textAlign: "right" }}>stronger</span></div>
        </Card>
      )}
      {depth.onlyThisWord.map((o, i) => <OnlyThis key={i} lemma={lemma} o={o} index={i} />)}
      <p className="sub small">Drafted by AI and checked by a second AI. Not reviewed by an editor.</p>
    </section>
  );
}

function OnlyThis({ lemma, o, index }: { lemma: string; o: Depth["onlyThisWord"][number]; index: number }) {
  const [pick, setPick] = useState<string | null>(null);
  const opts = index % 2 ? [o.other, lemma] : [lemma, o.other];       // fixed but varied order
  const [a, b] = o.sentence.split("____");
  const right = pick === lemma;
  return (
    <Reward on={right} colorVariant="ocean">
      <Card tone={pick ? (right ? "good" : "warn") : undefined}>
        <p style={{ marginTop: 0 }}><b>Only this word fits</b></p>
        <p className="sentence">{a}<span className="blank">{pick ? (right ? lemma : o.other) : "      "}</span>{b}</p>
        {!pick && <div className="row">{opts.map(w => <Btn key={w} kind="ghost" onClick={() => setPick(w)}>{w}</Btn>)}</div>}
        {pick && (
          <div className="stack" role="status">
            {right ? <p style={{ margin: 0 }}><b>Yes: &ldquo;{lemma}&rdquo; fits.</b></p> : <p style={{ margin: 0 }}><b>Not quite. &ldquo;{lemma}&rdquo; fits here.</b></p>}
            <p style={{ margin: 0 }}>Why not &ldquo;{o.other}&rdquo;? {o.whyNot}</p>
            <div className="row"><Btn kind="soft" icon={<Icon.Speaker />} onClick={() => say(o.sentence.replace("____", lemma))}>Listen</Btn><Btn kind="ghost" onClick={() => setPick(null)}>Try again</Btn></div>
          </div>
        )}
      </Card>
    </Reward>
  );
}
