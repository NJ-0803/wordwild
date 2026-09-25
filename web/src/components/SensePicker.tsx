"use client";
import type { Lang, Sense } from "@core";
import { say } from "@/lib/speech";
import { Btn, Card } from "./ui";

/** Which meaning did you mean? Never guesses silently. `suggested` (from the sentence they heard it in) is offered, not forced. */
export function SensePicker({ senses, lang, suggested, onPick }: { senses: Sense[]; lang: Lang; suggested?: number | null; onPick: (s: Sense) => void }) {
  return (
    <div className="stack">
      {senses.map((s, i) => (
        <Card key={s.senseId} tone={suggested === i ? "good" : undefined}>
          <h2>{s.lemma} <span className="pill">{s.pos}</span></h2>
          {suggested === i && <p className="small" style={{ margin: 0 }}><b>This looks like the meaning in your sentence.</b></p>}
          <p>{lang === "hi" && s.explanations.hi ? s.explanations.hi : s.simple}</p>
          {s.examples[0] && <p className="sub small">Example: {s.examples[0].text}</p>}
          <div className="row">
            <Btn kind="soft" icon="🔊" onClick={() => say(`${s.lemma}. ${s.simple}`)}>Listen</Btn>
            <Btn onClick={() => onPick(s)}>This one</Btn>
          </div>
        </Card>
      ))}
    </div>
  );
}
