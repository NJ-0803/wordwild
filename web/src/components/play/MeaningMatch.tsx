"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { dailyMatch, meaningOrder } from "@core";
import { useTown } from "@/lib/useTown";
import { fetchMeanings, mask, type Meaning } from "@/lib/meanings";

/** Meaning Match: pick a word, then the meaning that fits. Wrong picks just shake; matched pairs settle and stay. */
export function MeaningMatch() {
  const { day, play, ready } = useTown();
  const words = useMemo(() => dailyMatch(day), [day]);
  const order = useMemo(() => meaningOrder(day), [day]);
  const [meanings, setMeanings] = useState<Map<string, Meaning> | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [got, setGot] = useState<number[]>([]);
  const [bad, setBad] = useState<{ w: number; m: number; k: number } | null>(null);
  const missCount = useRef(0);
  const [tries, setTries] = useState(0);
  const rewarded = useRef(false);
  useEffect(() => { void fetchMeanings(words).then(setMeanings); }, [words]);
  const usable = meanings ? words.map((w, i) => (meanings.get(w) ? i : -1)).filter(i => i >= 0) : [];
  const all = usable.length > 0 && got.length >= usable.length;
  useEffect(() => { if (all && ready && !rewarded.current) { rewarded.current = true; play("match"); } }, [all, ready, play]);

  if (!meanings) return <p className="sub" role="status">Getting today&apos;s words…</p>;
  if (usable.length < 3) return <section className="card"><p className="sub">Today&apos;s words could not be loaded. Check your connection and try again.</p></section>;
  const mOrder = order.filter(i => usable.includes(i));
  const pick = (kind: "w" | "m", i: number) => {
    if (got.includes(i)) return;
    if (kind === "w") { setSel(s => (s === i ? null : i)); return; }
    if (sel === null) return;
    setTries(t => t + 1);
    if (sel === i) { setGot(g => [...g, i]); setSel(null); }
    else { setBad({ w: sel, m: i, k: missCount.current += 1 }); setSel(null); }
  };
  return (
    <div className="pz">
      <p className="pz-step">{got.length} of {usable.length} matched{tries - got.length > 0 ? ` · ${tries - got.length} tries that missed` : ""}</p>
      <div className="pz-match">
        <div className="pz-col" role="group" aria-label="Words">
          {usable.map(i => <button key={words[i] + (bad?.w === i ? bad.k : "")} className={`pz-card${sel === i ? " sel" : ""}${got.includes(i) ? " done" : ""}${bad?.w === i ? " miss" : ""}`} aria-pressed={sel === i} disabled={got.includes(i)} onClick={() => pick("w", i)}>{words[i]}</button>)}
        </div>
        <div className="pz-col" role="group" aria-label="Meanings">
          {mOrder.map(i => <button key={`${i}-${bad?.m === i ? bad.k : ""}`} className={`pz-card mean${got.includes(i) ? " done" : ""}${bad?.m === i ? " miss" : ""}`} disabled={got.includes(i) || sel === null} onClick={() => pick("m", i)}>{mask(meanings.get(words[i])!.simple, words[i])}</button>)}
        </div>
      </div>
      {sel === null && !all && <p className="sub small">Tap a word first, then its meaning.</p>}
      {all && (
        <section className="pz-end card" aria-live="polite">
          <p className="pz-badge">All matched</p>
          <ul className="pz-list">{usable.map(i => <li key={i}><b>{words[i]}</b><span>{meanings.get(words[i])!.simple}</span></li>)}</ul>
          <p className="sub small">+8 coins and +8 XP for your town.</p>
          <Link className="pz-link" href="/play">More puzzles</Link>
        </section>
      )}
    </div>
  );
}
