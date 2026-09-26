"use client";
import { Icon } from "./Icons";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { INTENTS, INTENT_LABEL, type Coach, type Intent } from "@core";
import { Btn, Card, LinkBtn } from "./ui";
import { Orb } from "./Companion";
import { say } from "@/lib/speech";
import { useStore } from "@/lib/store";
import { track } from "@/lib/metrics";
import { SentenceHover } from "./SentenceHover";

async function call(senseId: string, onlyCached: boolean): Promise<{ coach?: Coach; status: number; error?: string }> {
  const r = await fetch("/api/coach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ senseId, onlyCached }) });
  const j = await r.json().catch(() => ({})) as { coach?: Coach; error?: string };
  return { coach: j.coach, status: r.status, error: j.error };
}
const WHY: Record<string, string> = {
  quota: "You have used today's coaching. It resets tomorrow.", "quota-shared": "Free coaching for today has been used up. Sign in for your own daily allowance, or try again tomorrow.", busy: "The coach is busy. Nothing was used up. Please try again in a minute.",
  rejected: "The coach could not make checked examples for this word, so it shows nothing rather than something wrong.", "not-configured": "Coaching is not set up on this server.",
  "enrichment-not-configured": "Coaching is not set up on this server.",
};

/** How to USE the word: one example per situation, a memory hook, look-alike words, and when not to use it. */
export function CoachSection({ senseId, lemma, auto = false }: { senseId: string; lemma: string; auto?: boolean }) {
  const { isSignedIn } = useAuth();
  const { state } = useStore();
  const hi = state.prefs.explainLang === "hi";
  const [coach, setCoach] = useState<Coach | null>(null);
  const [checked, setChecked] = useState(false); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  const [intent, setIntent] = useState<Intent>("casual");

  const autoTried = useRef(false);
  useEffect(() => { let live = true; call(senseId, true).then(r => { if (live) { if (r.coach) { setCoach(r.coach); track("coach_seen"); } else if (auto && !autoTried.current) { autoTried.current = true; void make(); } setChecked(true); } }).catch(() => { if (live) setChecked(true); }); return () => { live = false; }; }, [senseId]);   // eslint-disable-line react-hooks/exhaustive-deps
  async function make() {
    setBusy(true); setMsg(null);
    try {
      const r = await call(senseId, false);
      if (r.coach) { setCoach(r.coach); setIntent(r.coach.examples[0]?.intent ?? "casual"); track("coach_seen"); }
      else setMsg(WHY[r.error ?? ""] ?? "Something went wrong. Please try again.");
    } catch { setMsg("You seem to be offline. Try again when you are connected."); }
    setBusy(false);
  }

  if (!coach) {
    if (!checked) return null;
    return (
      <Card>
        <h2 style={{ marginBottom: 6 }}>Word coach</h2>
        <p className="sub small">How to use &ldquo;{lemma}&rdquo; in a job interview, an essay, everyday talk and a story, a trick to remember it, and words it is easy to mix up with.</p>
        <Btn onClick={make} disabled={busy}>{busy ? "Coaching… (a few seconds)" : "Coach me on this word"}</Btn>
        {!isSignedIn && <p className="sub small">Free for everyone while the daily allowance lasts. <LinkBtn href="/sign-in" kind="ghost">Sign in for your own allowance</LinkBtn></p>}
        {busy && <div role="status" style={{ marginTop: 8 }}><Orb state="solving" size={96} label="Preparing your coaching" /></div>}
        {msg && <p role="alert"><b>{msg}</b></p>}
      </Card>
    );
  }
  const ex = coach.examples.find(e => e.intent === intent) ?? coach.examples[0];
  const avail = INTENTS.filter(i => coach.examples.some(e => e.intent === i));
  return (
    <section aria-labelledby="coach-h" className="stack">
      <h2 id="coach-h" style={{ fontSize: "1.4rem" }}>Word coach</h2>
      <Card>
        <p className="label" style={{ margin: "0 0 8px" }}>Where will you use it?</p>
        <div className="chips" role="group" aria-label="Choose a situation">
          {avail.map(i => <button key={i} className="chip" aria-pressed={i === intent} onClick={() => setIntent(i)}>{INTENT_LABEL[i].en}{hi ? <span lang="hi" style={{ marginLeft: 6, opacity: .8 }}>{INTENT_LABEL[i].hi}</span> : null}</button>)}
        </div>
        <SentenceHover text={ex.sentence} skip={[lemma]} style={{ marginTop: 14 }}><p className="sentence" style={{ margin: 0 }}>{ex.sentence}</p></SentenceHover>
        <Btn kind="soft" icon={<Icon.Speaker />} onClick={() => say(ex.sentence)}>Listen</Btn>
      </Card>
      {coach.memoryHook && <Card tone="good"><p className="label" style={{ margin: "0 0 6px" }}>Memory trick</p><p style={{ margin: 0 }}>{coach.memoryHook}</p><p className="sub small" style={{ margin: "6px 0 0" }}>A helper for remembering, not the history of the word.</p></Card>}
      {coach.confusables.length > 0 && (
        <Card>
          <p className="label" style={{ margin: "0 0 8px" }}>Easy to mix up with</p>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
            {coach.confusables.map(c => <li key={c.word}><b><Link href={`/capture?word=${encodeURIComponent(c.word)}`}>{c.word}</Link></b> <span className="sub">· {c.difference}</span><br /><span className="sub small">{c.word}: {c.definition}</span></li>)}
          </ul>
        </Card>
      )}
      {coach.notFor.length > 0 && (
        <Card tone="warn"><p className="label" style={{ margin: "0 0 6px" }}>Better not to use it when</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{coach.notFor.map(n => <li key={n}>{n}</li>)}</ul></Card>
      )}
      <p className="sub small">Drafted by AI and checked by a second AI. Not reviewed by an editor. Meanings of the look-alike words come from the dictionary.</p>
    </section>
  );
}
