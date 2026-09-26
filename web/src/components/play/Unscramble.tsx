"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { dailyScramble } from "@core";
import { Lumi } from "@/components/Companion";
import { useTown } from "@/lib/useTown";
import { usePersisted } from "@/lib/usePersisted";
import { fetchMeanings, mask, type Meaning } from "@/lib/meanings";

/** Unscramble: five words, letters mixed up, the meaning is the clue. Tap letters in order; tap a placed letter to take it back. */
export function Unscramble() {
  const { day, play, ready } = useTown();
  const items = useMemo(() => dailyScramble(day), [day]);
  const [solved, setSolved, loaded] = usePersisted<number[]>(`ww.play.unscramble.${day}`, []);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number[]>([]);                 // indexes into the scrambled letters, in the order tapped
  const [meanings, setMeanings] = useState<Map<string, Meaning>>(new Map());
  const [wrong, setWrong] = useState(0);
  const rewarded = useRef(false);
  useEffect(() => { void fetchMeanings(items.map(i => i.word)).then(setMeanings); }, [items]);
  const first = useRef(true);
  useEffect(() => { if (loaded && first.current) { first.current = false; const n = items.findIndex((_, i) => !solved.includes(i)); setIdx(n < 0 ? items.length : n); } }, [loaded, items, solved]);
  const done = idx >= items.length;
  useEffect(() => { if (done && loaded && ready && !rewarded.current) { rewarded.current = true; play("unscramble"); } }, [done, loaded, ready, play]);

  const cur = items[Math.min(idx, items.length - 1)];
  const m = meanings.get(cur.word);
  const guess = picked.map(i => cur.letters[i]).join("");
  const tap = (i: number) => {
    if (done || picked.includes(i)) return;
    const next = [...picked, i]; setPicked(next);
    if (next.length === cur.word.length) {
      if (next.map(k => cur.letters[k]).join("") === cur.word) { setSolved(s => [...new Set([...s, idx])]); setTimeout(() => { setPicked([]); setIdx(x => x + 1); }, 650); }
      else { setWrong(w => w + 1); setTimeout(() => setPicked([]), 520); }
    }
  };

  if (done) return (
    <section className="pz-end card">
      <Lumi size={80} mood="default" />
      <p className="pz-badge">All five done</p>
      <ul className="pz-list">{items.map(i => <li key={i.word}><b>{i.word}</b><span>{meanings.get(i.word)?.simple ?? ""}</span></li>)}</ul>
      <p className="sub small">+8 coins and +8 XP for your town.</p>
      <Link className="pz-link" href="/play">More puzzles</Link>
    </section>
  );
  return (
    <div className="pz">
      <p className="pz-step">Word {idx + 1} of {items.length}</p>
      <div className="pz-clue card" key={idx}><p>{m ? mask(m.simple, cur.word) : "Loading the clue…"}</p></div>
      <div className={`pz-row${wrong ? " shake" : ""}`} data-k={wrong} aria-label={`Your answer so far: ${guess || "nothing yet"}`}>
        {cur.word.split("").map((_, i) => <div key={i} className={`pz-tile${guess[i] ? " typed" : ""}${solved.includes(idx) ? " correct" : ""}`}><span key={guess[i] ?? ""}>{guess[i] ?? ""}</span></div>)}
      </div>
      <div className="pz-pool">
        {cur.letters.map((l, i) => <button key={i} className="pz-key big" disabled={picked.includes(i)} onClick={() => tap(i)}>{l}</button>)}
      </div>
      <div className="pz-actions">
        <button className="pz-link" onClick={() => setPicked(p => p.slice(0, -1))} disabled={!picked.length}>Undo last letter</button>
        <button className="pz-link" onClick={() => setPicked([])} disabled={!picked.length}>Clear</button>
      </div>
    </div>
  );
}
