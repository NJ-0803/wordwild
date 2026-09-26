"use client";
import { useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SENSE_BY_ID, tierOf, type Sense, gradeChoice, gradeExplain, masteryLevel, nextActivity, recommend, submitAttempt, worldProgress,
  type ChoiceItem, type ErrorType, type ExplainItem } from "@core";
import { useStore } from "@/lib/store";
import { useSense } from "@/lib/senses";
import { safeDecode } from "@/lib/senses";
import { Btn, Card, Field, LinkBtn } from "@/components/ui";
import { Loading, Reward, SpeakingOrb, WordBuddy } from "@/components/Companion";
import { WordScene } from "@/components/GardenScene";
import { say, stopSpeaking } from "@/lib/speech";

const ROUNDS = 3;
const uid = () => Math.random().toString(36).slice(2, 10);
const KIND: Record<string, string> = { "meaning-bridge": "Meaning", "conversation-choice": "What would you say?", "listen-and-find": "Listen and find", "word-connections": "Word connections", "explain-back": "Explain it back", "memory-encounter": "A new situation" };

export default function PracticePage() {
  const { id } = useParams<{ id: string }>(); const senseId = safeDecode(id);
  const { state, ready } = useStore();
  const sense = useSense(senseId);      // hooks first, then early returns
  if (!ready) return null;
  if (!state.senses[senseId]) return <Card tone="warn">Save this word first. <LinkBtn href="/capture" kind="ghost">Save a word</LinkBtn></Card>;
  if (sense === undefined) return <Loading />;
  if (sense === null || tierOf(sense) === "dictionary") return <Card tone="warn"><b>Practice for this word is not ready yet.</b><p className="sub small">We only offer practice questions that have been checked.</p><LinkBtn href={`/learn/${encodeURIComponent(senseId)}`} kind="ghost">Back to the word</LinkBtn></Card>;
  return <Session senseId={senseId} sense={sense} />;
}

function Session({ senseId, sense }: { senseId: string; sense: Sense }) {
  const { state, update, now } = useStore();
  const router = useRouter();
  const [round, setRound] = useState(0);
  const [seed, setSeed] = useState(() => `${senseId}:${uid()}`);
  const [prevPos, setPrevPos] = useState<number | null>(null);   // where the correct answer sat last time
  // the activity is chosen once per round; later state updates (from answering) must not swap the question
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activity = useMemo(() => nextActivity(state, sense, seed, prevPos), [seed, round]);
  const item = activity.item;
  const [hints, setHints] = useState(0); const [showHint, setShowHint] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [fb, setFb] = useState<{ correct: boolean | null; message: string; explanation?: string; model?: string } | null>(null);
  const [text, setText] = useState(""); const [ended, setEnded] = useState(false);
  const [cheers, setCheers] = useState(0);        // bumps on each correct answer: the plant bounces
  const rec = state.senses[senseId]; const lvl = masteryLevel(rec);
  const key = useRef(`${senseId}:${item.id}:${uid()}`);

  const record = (correct: boolean | null, errorType: ErrorType | null, h: number) =>
    update(s => submitAttempt(s, { key: key.current, senseId, activityId: item.id, skill: item.skill, correct, hintsUsed: h, errorType, at: now() }).state);

  const next = () => {
    stopSpeaking();
    if (item.kind !== "explain-back") setPrevPos(activity.optionOrder!.indexOf((item as ChoiceItem).correctId));
    if (round + 1 >= ROUNDS) { setEnded(true); return; }
    setRound(r => r + 1); setSeed(`${senseId}:${uid()}`);
    setHints(0); setShowHint(false); setPicked([]); setFb(null); setText("");
    key.current = `${senseId}:n:${uid()}`;
  };

  if (ended) return <Summary senseId={senseId} lemma={sense.lemma} />;

  const spoken = (item as ChoiceItem).spoken ?? item.prompt;
  const answerChoice = (optId: string) => {
    if (fb?.correct === true) return;
    const it = item as ChoiceItem; const r = gradeChoice(it, optId);
    const h = picked.length > 0 ? Math.max(1, hints) : hints;   // a retry after feedback is assisted evidence
    setPicked(p => [...p, optId]);
    if (r.correct) setCheers(c => c + 1);
    record(r.correct, r.errorType, h);
    key.current = `${senseId}:${it.id}:${uid()}`;
    setFb({ correct: r.correct, message: r.message, explanation: r.explanation });
    say(r.correct ? `${r.message} ${r.explanation}` : r.message);
  };
  const answerExplain = () => {
    const it = item as ExplainItem; const r = gradeExplain(it, text);
    if (r.correct) setCheers(c => c + 1);
    record(r.correct, null, hints);
    setFb({ correct: r.correct, message: r.message, model: r.modelAnswer });
    say(`${r.message} ${r.modelAnswer}`);
  };
  const done = fb && (fb.correct === true || item.kind === "explain-back");

  return (
    <div className="stack">
      <p className="sub small">{sense.lemma} · {KIND[item.kind]} · {round + 1} of {ROUNDS}</p>
      <WordScene stage={({ new: 0, seen: 1, practising: 2, secure: 3 } as const)[lvl]} label={sense.lemma} celebrate={cheers} summary={`${sense.lemma} is growing in your garden.`} />
      <Card>
        <div className="hero"><div style={{ flex: "0 0 auto" }}><WordBuddy lemma={sense.lemma} mastery={lvl} mood={fb?.correct === true ? "working" : "default"} size={56} /></div><h1 style={{ margin: 0, fontSize: "1.25rem" }}>{item.kind === "listen-and-find" ? "Listen, then choose." : item.prompt}</h1></div>
        <div className="row" style={{ marginTop: 12 }}>
          <Btn kind="soft" icon="🔊" onClick={() => say(spoken)}>Listen again</Btn>
          <Btn kind="soft" icon="💡" onClick={() => { if (!showHint) { setShowHint(true); setHints(h => h + 1); } }}>{showHint ? "Hint shown" : "Hint"}</Btn>
        </div>
        {showHint && <div className="card warn" style={{ marginTop: 10 }}>{item.hint}</div>}
      </Card>
      <SpeakingOrb />
      {item.kind === "explain-back" ? (
        <>
          <label className="sr" htmlFor="ex">Your explanation</label>
          <Field><textarea id="ex" rows={4} value={text} disabled={!!fb} placeholder="Type your explanation" onChange={e => setText(e.target.value)} /></Field>
          <p className="sub small">Speaking your answer is not available yet.</p>
          {!fb && <Btn onClick={answerExplain} disabled={!text.trim()}>Check my answer</Btn>}
          {!fb && <Btn kind="ghost" onClick={next}>Skip this one</Btn>}
        </>
      ) : (activity.optionOrder as string[]).map(oid => {
        const o = (item as ChoiceItem).options.find(x => x.id === oid)!;
        const was = picked.includes(oid); const good = was && oid === (item as ChoiceItem).correctId;
        return (
          <div className="row" key={oid}>
            <Btn className="opt" kind={good ? "primary" : was ? "soft" : "ghost"} disabled={fb?.correct === true || was} onClick={() => answerChoice(oid)}>{o.text}</Btn>
            <Btn kind="soft" className="icon" icon="🔊" aria-label={`Listen: ${o.text}`} onClick={() => say(o.text)}>{""}</Btn>
          </div>
        );
      })}
      {fb && (
        <Card tone={fb.correct === true ? "good" : "warn"}>
          <p role="status"><b>{fb.message}</b></p>
          {fb.explanation && fb.correct === true && <p>{fb.explanation}</p>}
          {fb.model && <><p><b>Example answer:</b></p><p>{fb.model}</p></>}
          {fb.correct === false && <p className="sub">That is okay. Try another choice.</p>}
        </Card>
      )}
      {done && <Btn onClick={next}>{round + 1 >= ROUNDS ? "Finish" : "Next"}</Btn>}
      {fb?.correct === false && <Btn kind="ghost" onClick={() => { const it = item as ChoiceItem; setFb({ correct: null, message: it.options.find(o => o.id === it.correctId)!.text, explanation: it.explanation }); }}>Show me the answer</Btn>}
      <Btn kind="ghost" onClick={() => { stopSpeaking(); router.push("/"); }}>Stop for now</Btn>
    </div>
  );
}

function Summary({ senseId, lemma }: { senseId: string; lemma: string }) {
  const { state, now } = useStore(); const rec = state.senses[senseId];
  const lvl = masteryLevel(rec); const w = worldProgress(state); const recs = recommend(state, SENSE_BY_ID, now(), 2);
  const ms = rec.due - now();
  const due = ms > 2 * 86_400_000 ? `We will bring it back in ${Math.round(ms / 86_400_000)} days, in a new situation.` : ms > 3_600_000 ? "We will bring it back tomorrow, in a new situation." : ms > 0 ? "We will bring it back in a few minutes." : "It is ready to practise again.";
  return (
    <div className="stack">
      <h1>Nice work</h1>
      <Reward on={lvl === "secure"} colorVariant="sunset"><Card tone="good"><h2>{lemma}: {lvl}</h2>
        {lvl === "secure" && <p><b>This word is secure. You used it in different ways and came back to it.</b></p>}
        <p>Saving a word and one right answer is a start. A word becomes secure after you use it in different ways and come back to it later.</p><p>{due}</p></Card></Reward>
      <Card>Your garden: {w.secure} secure · {w.practising} practising · {w.discovered} saved</Card>
      {recs.length > 0 && <><h2>Next</h2>{recs.map(r => <Card key={r.senseId}><b>{SENSE_BY_ID[r.senseId].lemma}</b><p className="sub">{r.reason.text}</p></Card>)}</>}
      <LinkBtn href="/">Done</LinkBtn>
    </div>
  );
}
