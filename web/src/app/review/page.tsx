"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { RATING_LABEL, ratingAttempt, reviewQueue, reviewSummary, submitAttempt, type Rating } from "@core";
import { useStore } from "@/lib/store";
import { useSense } from "@/lib/senses";
import { Btn, LinkBtn } from "@/components/ui";
import { Loading, WordBuddy } from "@/components/Companion";
import { Icon } from "@/components/Icons";
import { say } from "@/lib/speech";
import { track, trackOnce } from "@/lib/metrics";

const KEYS: Record<string, Rating> = { "1": "know", "2": "almost", "3": "forgot" };

/** One-tap review of the words that are ready: see the word, think of its meaning, reveal it, say how it went. */
export default function Review() {
  const { state, update, now, ready } = useStore();
  const [queue, setQueue] = useState<string[] | null>(null);
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const startedAt = useRef(0); const doneSent = useRef(false);
  useEffect(() => { if (ready && queue === null) { startedAt.current = now(); setQueue(reviewQueue(state, now(), 5)); } }, [ready, queue, state, now]);   // eslint-disable-line react-hooks/set-state-in-effect -- the queue is fixed when the session starts, so answering does not reshuffle it

  const id = queue?.[i] ?? null;
  useEffect(() => { if (queue && queue.length > 0 && !id && !doneSent.current) { doneSent.current = true; track("review_done"); } }, [queue, id]);
  const sense = useSense(id ?? "");
  const rate = useCallback((r: Rating) => {
    if (!id) return;
    update(s => submitAttempt(s, ratingAttempt(id, r, `review:${id}:${startedAt.current}`, now())).state);
    track(r === "know" ? "recall_unassisted" : r === "almost" ? "recall_assisted" : "recall_forgot"); trackOnce("first_review");
    setRatings(x => [...x, r]); setShown(false); setI(n => n + 1);
  }, [id, update, now]);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (!id || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!shown && (e.key === " " || e.key === "Enter")) { e.preventDefault(); setShown(true); }
      else if (shown && KEYS[e.key]) rate(KEYS[e.key]);
    };
    window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on);
  }, [id, shown, rate]);

  const tomorrow = useMemo(() => { const t = now(); return Object.values(state.senses).filter(r => r.lastAttemptAt > 0 && r.due > t && r.due <= t + 86_400_000 * 1.5).length; }, [state.senses, now]);

  if (!ready || queue === null) return <Loading />;
  if (queue.length === 0) return (
    <div className="stack"><h1>All caught up</h1><p className="sub">No words are waiting. Save a new word, or play today&apos;s puzzles.</p>
      <div className="row"><LinkBtn href="/capture">Save a word</LinkBtn><LinkBtn href="/play" kind="soft">Puzzles</LinkBtn></div></div>);

  if (!id) {
    const sum = reviewSummary(ratings);
    return (
      <div className="stack">
        <h1>{sum.headline}</h1>
        <div className="card good pz-end">
          <p className="sub" style={{ margin: 0 }}>You went through {sum.total} {sum.total === 1 ? "word" : "words"}.</p>
          <ul className="rv-tally" aria-label="Results">
            <li><b>{sum.know}</b><span>knew it</span></li><li><b>{sum.almost}</b><span>almost</span></li><li><b>{sum.forgot}</b><span>to see again</span></li>
          </ul>
          <p className="sub small" style={{ margin: 0 }}>{tomorrow > 0 ? `${tomorrow} more ${tomorrow === 1 ? "word comes" : "words come"} back tomorrow.` : "Words you missed come back sooner. Words you knew come back later."}</p>
        </div>
        <div className="row"><LinkBtn href="/notebook">Back to my words</LinkBtn><LinkBtn href="/play" kind="soft">Play a puzzle</LinkBtn></div>
      </div>
    );
  }

  return (
    <div className="stack rv">
      <p className="sub small" role="status">Word {i + 1} of {queue.length}</p>
      <div className="rv-bar" aria-hidden><i style={{ transform: `scaleX(${i / queue.length})` }} /></div>
      <div className="card raised rv-card" key={id}>
        {sense ? <>
          <WordBuddy lemma={sense.lemma} size={72} />
          <h1 className="rv-word">{sense.lemma}</h1>
          <p className="sub small" style={{ margin: 0 }}>{sense.pos}</p>
          {!shown ? <>
            <p className="sub">What does it mean? Think first, then check.</p>
            <Btn onClick={() => setShown(true)}>Show the meaning</Btn>
            <p className="sub small">Tip: press Space</p>
          </> : <>
            <p className="rv-mean">{sense.simple}</p>
            {sense.explanations?.hi && <p lang="hi" className="sub">{sense.explanations.hi}</p>}
            {sense.examples?.[0]?.text && <p className="sub small">&ldquo;{sense.examples[0].text}&rdquo;</p>}
            <div className="rv-rate" role="group" aria-label="How did it go?">
              {(["know", "almost", "forgot"] as Rating[]).map((r, n) => <button key={r} className={`rv-btn ${r}`} onClick={() => rate(r)}><span>{RATING_LABEL[r]}</span><kbd>{n + 1}</kbd></button>)}
            </div>
            <button className="pz-link" onClick={() => say(sense.lemma)}><Icon.Speaker /> Hear it</button>
          </>}
        </> : <p className="sub">Loading…</p>}
      </div>
      <p className="sub small"><Link className="pz-link" href="/notebook">Stop for now</Link></p>
    </div>
  );
}
