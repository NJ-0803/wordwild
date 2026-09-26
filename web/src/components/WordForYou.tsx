"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { capture, masteryLevel } from "@core";
import { useConstellation } from "@/lib/useConstellation";
import { fetchSense, getSenseSync } from "@/lib/senses";
import { useStore } from "@/lib/store";
import { Btn, Card } from "./ui";

/** A word chosen from the words YOU have been learning, with the reason shown. Nothing is guessed about topics: the link is the dictionary's own. */
export function WordForYou() {
  const { state } = useStore();
  const anchor = useMemo(() => Object.values(state.senses).filter(r => r.senseId.includes("%"))
    .sort((a, b) => (["practising", "secure"].includes(masteryLevel(b)) ? 1 : 0) - (["practising", "secure"].includes(masteryLevel(a)) ? 1 : 0) || Math.max(b.lastAttemptAt, b.capturedAt) - Math.max(a.lastAttemptAt, a.capturedAt))[0]?.senseId, [state.senses]);
  if (!anchor) return null;
  return <Inner anchor={anchor} />;
}

function Inner({ anchor }: { anchor: string }) {
  const { update, now } = useStore();
  const { state: c } = useConstellation(anchor);
  const [saved, setSaved] = useState(false);
  const from = getSenseSync(anchor)?.lemma;
  if (c.status !== "ready" || !c.data.picks.length || !from) return null;
  const p = c.data.picks[0];
  const save = async () => {
    const sense = await fetchSense(p.senseId); if (!sense) return;
    update(s => capture(s, { status: "found", senses: [sense], source: "constellation" }, { source: "Word for you", context: `Suggested because you learned "${from}"`, now: now() }).state);
    setSaved(true);
  };
  return (
    <Card>
      <p className="label" style={{ margin: 0 }}>A word for you</p>
      <h2 style={{ fontFamily: "var(--font-serif), Georgia, serif", fontWeight: 400, fontSize: "2rem", margin: "6px 0 2px" }}>{p.lemma} <span className="pill">{p.pos}</span></h2>
      <p style={{ margin: "0 0 6px" }}>{p.simple}</p>
      <p className="sub small" style={{ margin: "0 0 10px" }}><b>Why you are seeing this.</b> You have been learning &ldquo;{from}&rdquo;. {p.why}</p>
      <div className="row">{saved ? <span className="sub small" role="status">Saved to your words</span> : <Btn onClick={() => void save()}>Save it</Btn>}<Link className="btn soft" href={`/word/${encodeURIComponent(p.lemma)}`}>Read more</Link></div>
    </Card>
  );
}
