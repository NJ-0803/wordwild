"use client";
import { useEffect, useMemo, useState } from "react";
import { capture, safeLookup, SENSE_BY_ID, type Beat, type Scene } from "@core";
import { WebDictionary } from "@/lib/senses";
import { useStore } from "@/lib/store";
import { say } from "@/lib/speech";
import { Btn } from "@/components/ui";
import { Reward, SpeakingOrb } from "@/components/Companion";

const provider = new WebDictionary();
const SPEAKERS: Record<string, string> = { Narrator: "📖", You: "🙂" };

/** One story scene, beat by beat. Listen, notice a word, decide, see what happens. No timers, no penalty: a poor choice gets a kind reason and another try. */
export function SceneStage({ scene, done, onFinish }: { scene: Scene; done: boolean; onFinish: () => void }) {
  const { state, update, now } = useStore();
  const hi = state.prefs.explainLang === "hi";
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const beat: Beat = scene.beats[at];
  const shown = scene.beats.slice(0, at + 1);
  const known = useMemo(() => new Set(Object.keys(state.senses)), [state.senses]);

  const bestPicked = (i: number) => { const b = scene.beats[i]; return b.kind === "choose" && picked[i] !== undefined && b.options[picked[i]].outcome === "best"; };
  const canNext = beat.kind !== "choose" || bestPicked(at);
  useEffect(() => { if (state.prefs.audioFirst && beat.kind === "say") say(beat.text); }, [at]);   // eslint-disable-line react-hooks/exhaustive-deps

  const saveWord = async (senseId: string) => {
    const lemma = SENSE_BY_ID[senseId]?.lemma; if (!lemma) return;
    const res = await safeLookup(provider, lemma, 8000);
    update(s => { const r = capture(s, res, { context: `From the story: ${scene.title}`, source: "Town story", senseId, now: now() }); return r.state; });
    setSaved(x => ({ ...x, [senseId]: true }));
  };

  return (
    <div aria-live="polite" style={{ display: "grid", gap: 10 }}>
      <SpeakingOrb />
      {shown.map((b, i) => {
        if (b.kind === "say") return (
          <div key={i} className="order" style={{ gap: 4 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <b>{SPEAKERS[b.who] ?? "💬"} {b.who}</b>
              <button className="chip" onClick={() => say(b.text)} aria-label={`Listen: ${b.who}`}>🔊 Listen</button>
            </div>
            <p style={{ margin: 0 }}>{b.text}</p>
            {hi && b.hi && <p lang="hi" className="sub" style={{ margin: 0 }}>{b.hi}</p>}
          </div>);
        if (b.kind === "word") { const s = SENSE_BY_ID[b.senseId]; const have = saved[b.senseId] || known.has(b.senseId); return (
          <div key={i} className="order" style={{ borderColor: "var(--navy-glow)" }}>
            <p style={{ margin: 0 }}>✨ New word: <b style={{ fontSize: "1.2rem" }}>{s?.lemma}</b></p>
            <p className="sub" style={{ margin: 0 }}>{b.note}</p>
            <div className="row"><button className="chip" onClick={() => say(s?.lemma ?? "")}>🔊 Say it</button>
              {have ? <span className="sub small" role="status">Saved to your garden ✓</span> : <Btn kind="soft" onClick={() => saveWord(b.senseId)}>Save this word</Btn>}</div>
          </div>); }
        if (b.kind === "choose") return (
          <div key={i} className="order">
            <p style={{ margin: 0 }}><b>{b.prompt}</b></p>
            {hi && b.hi && <p lang="hi" className="sub" style={{ margin: 0 }}>{b.hi}</p>}
            <div style={{ display: "grid", gap: 8 }}>
              {b.options.map((o, j) => (
                <button key={j} className="chip" style={{ textAlign: "left", height: "auto", borderRadius: 16, padding: "10px 14px" }} aria-pressed={picked[i] === j}
                  disabled={bestPicked(i)} onClick={() => { setPicked(p => ({ ...p, [i]: j })); say(o.reply); }}>
                  {o.text}{hi && o.hi ? <><br /><span lang="hi" style={{ fontWeight: 400 }}>{o.hi}</span></> : null}
                </button>))}
            </div>
            {picked[i] !== undefined && (() => { const o = b.options[picked[i]]; return (
              <Reward on={o.outcome === "best"} colorVariant="ocean"><div role="status" className="order" style={{ borderColor: o.outcome === "best" ? "var(--navy-glow)" : "var(--line)" }}>
                <p style={{ margin: 0 }}><i>{o.reply}</i></p>
                <p style={{ margin: 0 }}>{o.outcome === "best" ? "✓ " : "Let us think again. "}{o.why}</p>
                {o.outcome !== "best" && <p className="sub small" style={{ margin: 0 }}>Try another answer. There is no penalty.</p>}
              </div></Reward>); })()}
          </div>);
        return (
          <Reward key={i} on colorVariant="sunset"><div className="order" style={{ borderColor: "var(--navy-glow)" }}>
            <p style={{ margin: 0 }}><b>The end of this scene</b></p><p style={{ margin: 0 }}>{b.summary}</p>
          </div></Reward>);
      })}
      {beat.kind !== "end"
        ? <Btn onClick={() => setAt(a => a + 1)} disabled={!canNext}>{canNext ? "Next" : "Choose an answer to continue"}</Btn>
        : done ? <p className="sub small">You have finished this scene before. Replaying is always free.</p> : <Btn onClick={onFinish}>Finish the scene</Btn>}
    </div>
  );
}
