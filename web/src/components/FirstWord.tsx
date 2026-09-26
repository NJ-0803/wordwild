"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LangToggle } from "./LangToggle";
import { Lumi } from "./Companion";
import { Field } from "./ui";

const TRY = ["serendipity", "resilient", "ephemeral", "candid"];

/** The whole first screen: one box, one word. Saving it takes a few seconds; everything else waits until it matters. */
export function FirstWord() {
  const router = useRouter(); const [q, setQ] = useState(""); const ref = useRef<HTMLInputElement>(null);
  const go = (w: string) => { const t = w.trim(); if (t) router.push(`/capture?word=${encodeURIComponent(t.slice(0, 48))}`); };
  return (
    <div className="fw">
      <Lumi size={84} />
      <h1 className="display" style={{ margin: 0 }}>Save your first word</h1>
      <p className="sub" style={{ margin: 0, maxWidth: "44ch" }}>Type a word you heard or read today. You will see its meaning straight away, in simple words.</p>
      <form className="fw-form" onSubmit={e => { e.preventDefault(); go(q); }}>
        <Field><input ref={ref} autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="for example: serendipity" aria-label="A word to save" autoComplete="off" autoCapitalize="none" spellCheck={false} enterKeyHint="go" /></Field>
        <button className="btn" type="submit" disabled={!q.trim()}>Find the meaning</button>
      </form>
      <div className="fw-try" aria-label="Or try one of these">{TRY.map(w => <button key={w} className="chip" onClick={() => go(w)}>{w}</button>)}</div>
      <LangToggle />
    </div>
  );
}
