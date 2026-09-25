"use client";
import { useState } from "react";
import { COMFORT_PROMPTS, INTERESTS, type AgeBand, type LearnerProfile, type Purpose, type ReadingComfort, type Schooling } from "@core";
import { useStore } from "@/lib/store";
import { Btn, Card } from "./ui";

const PURPOSES: [Purpose, string][] = [["work", "For work"], ["study", "For study"], ["reading", "To read books and news"], ["movies", "To follow movies and shows"], ["daily", "For daily life"], ["exam", "For an exam"]];
const AGES: [AgeBand, string][] = [["under13", "Under 13"], ["13-17", "13 to 17"], ["18-29", "18 to 29"], ["30-49", "30 to 49"], ["50+", "50 or more"]];
const SCHOOLS: [Schooling, string][] = [["none-little", "I did not study much"], ["school", "School"], ["college", "College"], ["advanced", "Advanced studies"]];

/**
 * A polite, skippable "tell us about you". Every question can be skipped, "prefer not to say" is the default,
 * and age and schooling are asked last and only tune tone and topics, never what someone is allowed to see.
 */
export function ProfileCard({ onDone }: { onDone?: () => void }) {
  const { update, now } = useStore();
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Omit<LearnerProfile, "updatedAt">>({ interests: [] });
  const finish = (final: Omit<LearnerProfile, "updatedAt"> = p) => {
    update(s => ({ ...s, prefs: { ...s.prefs, profile: { ...final, updatedAt: now() } } }));
    onDone?.();
  };
  const next = () => (step >= 3 ? finish() : setStep(step + 1));
  const toggle = (i: string) => setP(v => ({ ...v, interests: v.interests.includes(i) ? v.interests.filter(x => x !== i) : v.interests.length < 6 ? [...v.interests, i] : v.interests }));

  return (
    <Card tone="good">
      <h2>Help us pick words that fit you</h2>
      <p className="sub small">Optional. Skip any question. There are no wrong answers, and nothing here limits what you can learn.</p>
      {step === 0 && (<div className="stack">
        <p><b>How do you usually read English?</b></p>
        {COMFORT_PROMPTS.map(c => <Btn key={c.value} kind={p.readingComfort === c.value ? "primary" : "ghost"} onClick={() => { setP(v => ({ ...v, readingComfort: c.value as ReadingComfort })); setStep(1); }}>{c.label}</Btn>)}
        <Btn kind="soft" onClick={next}>Skip this question</Btn>
      </div>)}
      {step === 1 && (<div className="stack">
        <p><b>What do you enjoy?</b> <span className="sub small">(pick up to 6)</span></p>
        <div className="chips">{INTERESTS.map(i => <button key={i} type="button" className="chip" aria-pressed={p.interests.includes(i)} onClick={() => toggle(i)}>{i}</button>)}</div>
        <div className="row"><Btn kind="ghost" onClick={() => setStep(0)}>Back</Btn><Btn onClick={next}>{p.interests.length ? "Next" : "Skip"}</Btn></div>
      </div>)}
      {step === 2 && (<div className="stack">
        <p><b>Why are you learning words?</b></p>
        <div className="chips">{PURPOSES.map(([v, l]) => <button key={v} type="button" className="chip" aria-pressed={p.purpose === v} onClick={() => setP(x => ({ ...x, purpose: v }))}>{l}</button>)}</div>
        <div className="row"><Btn kind="ghost" onClick={() => setStep(1)}>Back</Btn><Btn onClick={next}>{p.purpose ? "Next" : "Skip"}</Btn></div>
      </div>)}
      {step === 3 && (<div className="stack">
        <p><b>About you</b> <span className="sub small">Only if you would like to share. Prefer not to say is completely fine.</span></p>
        <div className="chips">{AGES.map(([v, l]) => <button key={v} type="button" className="chip" aria-pressed={p.ageBand === v} onClick={() => setP(x => ({ ...x, ageBand: x.ageBand === v ? undefined : v }))}>{l}</button>)}</div>
        <p className="sub small" style={{ marginBottom: 0 }}>If you are happy to say: how far did you study?</p>
        <div className="chips">{SCHOOLS.map(([v, l]) => <button key={v} type="button" className="chip" aria-pressed={p.schooling === v} onClick={() => setP(x => ({ ...x, schooling: x.schooling === v ? undefined : v }))}>{l}</button>)}</div>
        <div className="row"><Btn kind="ghost" onClick={() => setStep(2)}>Back</Btn><Btn onClick={() => finish()}>{p.ageBand || p.schooling ? "Done" : "Prefer not to say"}</Btn></div>
      </div>)}
    </Card>
  );
}
