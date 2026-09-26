"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LEVELS, LEVEL_LABEL, dailyScramble, formatTime, heardMatches, spokenWord, type Level } from "@core";
import { useTown } from "@/lib/useTown";
import { usePersisted } from "@/lib/usePersisted";
import { fetchMeanings, mask, type Meaning } from "@/lib/meanings";
import { MicButton, Stopwatch, useQuake, useSpeech, useStopwatch } from "@/lib/puzzle";
import { postResult } from "@/lib/results";
import { Icon } from "@/components/Icons";
import { Lumi } from "@/components/Companion";

/** Unscramble at four levels. Tap letters in order, or just say the word. The clock runs from your first move. */
export function Unscramble() {
  const { day } = useTown();
  const [pref, setPref] = usePersisted<{ level: Level }>("ww.play.unscramble.level", { level: "easy" });
  return <Run key={`${day}-${pref.level}`} day={day} level={pref.level} setLevel={l => setPref(() => ({ level: l }))} />;
}

function Run({ day, level, setLevel }: { day: number; level: Level; setLevel: (l: Level) => void }) {
  const { play, ready } = useTown();
  const items = useMemo(() => dailyScramble(day, level), [day, level]);
  const [solved, setSolved, loaded] = usePersisted<number[]>(`ww.play.unscramble.${day}.${level}`, []);
  const sw = useStopwatch(`ww.play.unscramble.${day}.${level}.t`);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number[]>([]);
  const [meanings, setMeanings] = useState<Map<string, Meaning>>(new Map());
  const [wrong, setWrong] = useState(0);
  const [first, setFirst] = useState(false);
  const [heard, setHeard] = useState("");
  const quake = useQuake();
  const rewarded = useRef(false); const posted = useRef(false); const init = useRef(true);
  useEffect(() => { void fetchMeanings(items.map(i => i.word)).then(setMeanings); }, [items]);
  useEffect(() => { if (loaded && init.current) { init.current = false; const n = items.findIndex((_, i) => !solved.includes(i)); setIdx(n < 0 ? items.length : n); } }, [loaded, items, solved]);  
  const done = idx >= items.length;
  useEffect(() => {
    if (!done || !loaded || !ready) return;
    if (!rewarded.current) { rewarded.current = true; play("unscramble"); }
    if (!posted.current) { posted.current = true; const ms = sw.stop(); postResult({ game: "unscramble", day, level, ms, tries: 0, won: true }); }
  }, [done, loaded, ready, play, sw, day, level]);

  const cur = items[Math.min(idx, items.length - 1)];
  const m = meanings.get(cur.word);
  const guess = picked.map(i => cur.letters[i]).join("");

  const win = useCallback(() => {
    setSolved(s => [...new Set([...s, idx])]);
    quake.trigger(idx === items.length - 1);
    setTimeout(() => { setPicked([]); setFirst(false); setHeard(""); setIdx(x => x + 1); }, 750);
  }, [idx, items.length, quake, setSolved]);
  const tap = (i: number) => {
    if (done || picked.includes(i)) return;
    sw.start();
    const next = [...picked, i]; setPicked(next);
    if (next.length === cur.word.length) {
      if (next.map(k => cur.letters[k]).join("") === cur.word) win();
      else { setWrong(w => w + 1); setTimeout(() => setPicked([]), 520); }
    }
  };
  const onHeard = useCallback((alts: string[]) => {
    sw.start(); setHeard(alts[0] ?? "");
    if (heardMatches(cur.word, alts)) {
      const used = new Set<number>(); const order: number[] = [];
      for (const ch of cur.word) { const k = cur.letters.findIndex((l, j) => l === ch && !used.has(j)); used.add(k); order.push(k); }
      setPicked(order); win();
    } else setWrong(w => w + 1);
  }, [cur, sw, win]);
  const speech = useSpeech(onHeard);

  if (done) return (
    <div className="pz">
      <LevelBar level={level} setLevel={setLevel} day={day} />
      <section className="pz-end card">
        <Lumi size={80} />
        <p className="pz-badge">All five done · {formatTime(sw.ms)}</p>
        <ul className="pz-list">{items.map(i => <li key={i.word}><b>{i.word}</b><span>{meanings.get(i.word)?.simple ?? ""}</span></li>)}</ul>
        <p className="sub small">+8 coins and +8 XP for your town. Try the next level, or see how your friends did.</p>
        <Link className="pz-link" href="/play">Puzzles and friends</Link>
      </section>
      {quake.wave}
    </div>
  );
  return (
    <>
      <div className={`pz ${quake.cls}`}>
        <LevelBar level={level} setLevel={setLevel} day={day} />
        <div className="pz-bar"><p className="pz-step" style={{ margin: 0 }}>Word {idx + 1} of {items.length}</p><Stopwatch ms={sw.ms} running={sw.running} /></div>
        <div className="pz-clue card" key={idx}><p>{m ? mask(m.simple, cur.word) : "Loading the clue…"}</p>{m && <p className="sub small" style={{ margin: "6px 0 0" }}>{m.pos} · {cur.word.length} letters{first ? ` · starts with ${cur.word[0].toUpperCase()}` : ""}</p>}</div>
        <div className="pz-row" key={`r${wrong}`} aria-label={`Your answer so far: ${guess || "nothing yet"}`} style={wrong ? { animation: "pz-shake .32s var(--ease-io)" } : undefined}>
          {cur.word.split("").map((_, i) => <div key={i} className={`pz-tile${guess[i] ? " typed" : ""}${solved.includes(idx) ? " correct" : ""}`}><span key={guess[i] ?? ""}>{guess[i] ?? ""}</span></div>)}
        </div>
        <div className="pz-pool">{cur.letters.map((l, i) => <button key={i} className="pz-key big" disabled={picked.includes(i)} onClick={() => tap(i)}>{l}</button>)}</div>
        {speech.supported && <><MicButton listening={speech.listening} onClick={speech.listen} /><p className="pz-heard" role="status">{speech.note || (heard ? `I heard “${spokenWord(heard) || heard}”.` : "")}</p></>}
        <div className="pz-actions">
          <button className="pz-link" onClick={() => setPicked(p => p.slice(0, -1))} disabled={!picked.length}>Undo last letter</button>
          <button className="pz-link" onClick={() => setPicked([])} disabled={!picked.length}>Clear</button>
          {!first && <button className="pz-link" onClick={() => setFirst(true)}>Show the first letter</button>}
        </div>
      </div>
      {quake.wave}
    </>
  );
}

function LevelBar({ level, setLevel, day }: { level: Level; setLevel: (l: Level) => void; day: number }) {
  const [, setN] = useState(0);
  useEffect(() => { const t = setInterval(() => setN(n => n + 1), 1500); return () => clearInterval(t); }, []);
  const isDone = (l: Level) => { try { return (JSON.parse(localStorage.getItem(`ww.play.unscramble.${day}.${l}`) ?? "[]") as number[]).length >= 5; } catch { return false; } };
  return (
    <div className="pz-levels" role="group" aria-label="Difficulty">
      {LEVELS.map(l => <button key={l} className="chip" aria-pressed={level === l} onClick={() => setLevel(l)}>{LEVEL_LABEL[l]}{isDone(l) && <span className="tick" aria-label="done"><Icon.Check /></span>}</button>)}
    </div>
  );
}
