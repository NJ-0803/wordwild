"use client";
import { Icon } from "./Icons";
import { useState } from "react";
import { ROLE_LABEL, capture, relativeLabel, type Pick } from "@core";
import { useConstellation } from "@/lib/useConstellation";
import { fetchSense } from "@/lib/senses";
import { useStore } from "@/lib/store";
import { say } from "@/lib/speech";
import { Btn, Card, LinkBtn } from "./ui";
import { ConstellationScene } from "./ConstellationScene";
import { ProfileCard } from "./ProfileCard";
import { ROLE_COLOR } from "./Constellation3D";
import { Reward, WordBuddy } from "./Companion";
import { ThinkingOrb } from "thinking-orbs";
import { useReducedMotion } from "@/lib/motion";

/** One word in, six words out. This is the heart of Wordwild's story. */
export function ConstellationSection({ senseId, lemma }: { senseId: string; lemma: string }) {
  const { state, update, now } = useStore();
  const { state: c, est, retry } = useConstellation(senseId);
  const [selected, setSelected] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [why, setWhy] = useState(false);
  const reduced = useReducedMotion();
  const profileAsked = !!state.prefs.profile;

  const save = async (p: Pick) => {
    const sense = await fetchSense(p.senseId); if (!sense) return;
    update(s => capture(s, { status: "found", senses: [sense], source: "constellation" }, { source: "Constellation", context: `Found next to "${lemma}"`, now: now() }).state);
    setSaved(prev => new Set(prev).add(p.senseId));
  };

  return (
    <section aria-labelledby="const-h" className="stack">
      <h2 id="const-h" style={{ fontSize: "1.4rem" }}>Words that travel with &ldquo;{lemma}&rdquo;</h2>
      {!profileAsked && <ProfileCard />}

      {c.status === "loading" && (
        <Card><div className="row" style={{ justifyContent: "flex-start", gap: 14 }} role="status">
          <span style={{ flex: "0 0 auto" }}><ThinkingOrb state="connecting" size={64} paused={reduced} /></span>
          <span><b>Finding words that fit you…</b><br /><span className="sub small">Checking how hard each word is for you.</span></span>
        </div></Card>
      )}
      {c.status === "error" && <Card tone="warn"><p>We could not find related words right now.{c.reason === "not-configured" ? " This part is not switched on yet." : ""}</p><Btn kind="soft" onClick={retry}>Try again</Btn></Card>}

      {c.status === "ready" && c.data.picks.length === 0 && <Card>We do not have related words for this one yet.</Card>}
      {c.status === "ready" && c.data.picks.length > 0 && (<>
        <p className="sub" style={{ margin: 0 }}>Chosen for you. Closer to the star means easier; farther means a bigger stretch. Tap a word.</p>
        <ConstellationScene target={lemma} picks={c.data.picks} learnerLevel={est.level} selected={selected} onSelect={setSelected} />
        <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {c.data.picks.map(p => (
            <li key={p.senseId} id={`w-${p.lemma}`}>
              <Reward on={saved.has(p.senseId)} colorVariant="sunset">
                <Card style={selected === p.senseId ? { outline: `3px solid ${ROLE_COLOR[p.role]}` } : undefined}>
                  <div className="hero">
                    <div style={{ flex: "0 0 auto" }}><WordBuddy lemma={p.lemma} size={52} /></div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: 0, fontSize: "1.3rem" }}>{p.lemma} <span className="pill">{p.pos}</span></h3>
                      <span className="role" style={{ background: ROLE_COLOR[p.role] }}>{ROLE_LABEL[p.role]}</span>{" "}
                      <span className="sub small">{relativeLabel(p.level, est.level)}</span>
                    </div>
                  </div>
                  <p style={{ margin: "8px 0 4px" }}>{p.simple}</p>
                  <p className="sub small" style={{ marginTop: 0 }}>{p.why}</p>
                  <div className="row">
                    <Btn kind="soft" icon={<Icon.Speaker />} onClick={() => say(`${p.lemma}. ${p.simple}`)}>Listen</Btn>
                    <Btn kind={saved.has(p.senseId) || state.senses[p.senseId] ? "ghost" : "primary"} disabled={saved.has(p.senseId) || !!state.senses[p.senseId]} onClick={() => save(p)}>{saved.has(p.senseId) || state.senses[p.senseId] ? "Saved" : "Save this word"}</Btn>
                  </div>
                  <LinkBtn href={`/learn/${encodeURIComponent(p.senseId)}`} kind="ghost">Open {p.lemma}</LinkBtn>
                </Card>
              </Reward>
            </li>
          ))}
        </ul>
        <Btn kind="soft" onClick={() => setWhy(w => !w)} aria-expanded={why}>{why ? "Hide" : "How were these words chosen?"}</Btn>
        {why && <Card>
          <p><b>What we used</b></p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>{est.factors.map((f, i) => <li key={i}>{f}</li>)}</ul>
          <p className="sub small">Words come from a real dictionary{c.data.mode === "ai" ? " and an AI that suggests related words and judges how hard each one is. The AI can be wrong, and the dictionary has the last word" : " (sign in and the AI will also suggest words and judge difficulty)"}. Your age and schooling are never used to limit words.</p>
        </Card>}
      </>)}
    </section>
  );
}
