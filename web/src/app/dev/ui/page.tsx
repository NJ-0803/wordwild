"use client";
import { notFound } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/ui";
import { Btn } from "@/components/ui";
import { Loading, Lumi, Reward, WordBuddy } from "@/components/Companion";
import { WordScene } from "@/components/GardenScene";
import { ThinkingOrb, type OrbState } from "thinking-orbs";

const ORBS: OrbState[] = ["working", "searching", "solving", "listening", "connecting", "weaving", "composing", "breathing", "shaping"];

/** Development-only gallery of every companion, orb state, reward and word scene. 404 in production. */
export default function UiGallery() {
  if (process.env.NODE_ENV === "production") notFound();
  const [cheers, setCheers] = useState(0); const [stage, setStage] = useState<0 | 1 | 2 | 3>(1);
  return (
    <div className="stack">
      <h1>UI gallery</h1>
      <h2>Word buddies</h2>
      <div className="row" style={{ flexWrap: "wrap", justifyContent: "flex-start" }}>
        {["euphemism", "tactful", "polite", "blunt", "skeptical", "indirect"].map((w, i) => (
          <div key={w} style={{ textAlign: "center", flex: "0 0 30%" }}><WordBuddy lemma={w} mastery={i === 2 ? "secure" : "practising"} due={i === 3} size={64} /><div className="small sub">{w}<br />{i === 2 ? "resting" : i === 3 ? "due" : "awake"}</div></div>
        ))}
      </div>
      <h2>Lumi</h2><div className="row" style={{ justifyContent: "flex-start" }}><Lumi size={64} /><Lumi mood="working" size={64} /><Lumi mood="sleeping" size={64} /></div>
      <h2>Orb states</h2>
      <div className="row" style={{ flexWrap: "wrap", justifyContent: "flex-start" }}>
        {ORBS.map(o => <div key={o} style={{ textAlign: "center", flex: "0 0 30%" }}><ThinkingOrb state={o} size={64} /><div className="small sub">{o}</div></div>)}
      </div>
      <Loading text="Loading your words…" />
      <h2>Reward beam</h2>
      <Reward on colorVariant="sunset"><Card tone="good"><b>euphemism: secure</b><p className="sub small">This word is secure.</p></Card></Reward>
      <Reward on colorVariant="mono"><Card><b>Notebook row (secure)</b></Card></Reward>
      <h2>Word scene</h2>
      <WordScene stage={stage} label="euphemism" celebrate={cheers} summary="preview" />
      <div className="row"><Btn kind="soft" onClick={() => setCheers(c => c + 1)}>Correct answer!</Btn><Btn kind="soft" onClick={() => setStage(s => ((s + 1) % 4) as 0 | 1 | 2 | 3)}>Grow a stage</Btn></div>
    </div>
  );
}
