"use client";
import { Icon } from "@/components/Icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ANSWERS_5, MAX_TRIES, dailyAnswer, keyStates, scoreGuess, shareGrid, wordStatus, type Mark } from "@core";
import { useTown } from "@/lib/useTown";
import { usePersisted } from "@/lib/usePersisted";
import { fetchMeanings, knownWord, mask, type Meaning } from "@/lib/meanings";
import { Btn } from "@/components/ui";

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const MARK_LABEL: Record<Mark, string> = { correct: "right place", present: "in the word, wrong place", absent: "not in the word" };

/** Word of the Day: guess the five-letter word in six tries. The meaning is one tap away at any time, because the point is to learn it. */
export function WordGame() {
  const { day, play, ready } = useTown();
  const answer = useMemo(() => dailyAnswer(day), [day]);
  const [saved, setSaved, loaded] = usePersisted<{ guesses: string[] }>(`ww.play.word.${day}`, { guesses: [] });
  const [cur, setCur] = useState("");
  const [msg, setMsg] = useState("");
  const [shake, setShake] = useState(false);
  const [hint, setHint] = useState<Meaning | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const busy = useRef(false);
  const rewarded = useRef(false);
  const guesses = saved.guesses;
  const status = wordStatus(answer, guesses);
  const keys = useMemo(() => keyStates(answer, guesses), [answer, guesses]);
  const [flipFrom, setFlipFrom] = useState(Infinity);   // only rows submitted in this visit flip; rows restored from storage just appear

  useEffect(() => { if (status !== "playing" && ready && loaded && !rewarded.current) { rewarded.current = true; play("word"); } }, [status, ready, loaded, play]);
  useEffect(() => { if (status === "playing" && hint === undefined) return; if (status !== "playing" && hint === undefined) void fetchMeanings([answer]).then(m => setHint(m.get(answer) ?? null)); }, [status, hint, answer]);

  const flash = useCallback((t: string) => { setMsg(t); setShake(false); requestAnimationFrame(() => setShake(true)); }, []);
  const submit = useCallback(async () => {
    if (busy.current || status !== "playing") return;
    if (cur.length < 5) return flash("Five letters, please.");
    busy.current = true;
    try {
      if (!ANSWERS_5.includes(cur) && (await knownWord(cur)) === false) return flash("That is not in our word list.");
      setFlipFrom(f => Math.min(f, guesses.length));
      setSaved(s => ({ guesses: [...s.guesses, cur] })); setCur(""); setMsg("");
    } finally { busy.current = false; }
  }, [cur, status, guesses.length, flash, setSaved]);
  const type = useCallback((k: string) => { if (status !== "playing") return; setMsg(""); setCur(c => (c.length < 5 ? c + k : c)); }, [status]);
  const back = useCallback(() => setCur(c => c.slice(0, -1)), []);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Enter") { e.preventDefault(); void submit(); }
      else if (e.key === "Backspace") back();
      else if (/^[a-z]$/i.test(e.key)) type(e.key.toLowerCase());
    };
    window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on);
  }, [submit, back, type]);

  const askHint = async () => { if (hint === undefined) setHint(null); const m = (await fetchMeanings([answer])).get(answer); setHint(m ?? null); };
  const share = async () => { try { await navigator.clipboard.writeText(shareGrid(answer, guesses, day)); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setMsg("Could not copy. Select and copy it by hand."); } };

  const rows = Array.from({ length: MAX_TRIES }, (_, r) => {
    const g = guesses[r]; const marks = g ? scoreGuess(answer, g) : null;
    const letters = g ?? (r === guesses.length && status === "playing" ? cur : "");
    return { r, g, marks, letters };
  });

  return (
    <div className="pz" aria-live="off">
      <div className="pz-grid" role="grid" aria-label="Guesses">
        {rows.map(({ r, g, marks, letters }) => (
          <div key={r} role="row" className={`pz-row${r === guesses.length && shake ? " shake" : ""}`} onAnimationEnd={e => { if (e.target === e.currentTarget) setShake(false); }}>
            {Array.from({ length: 5 }, (_, i) => {
              const ch = letters[i] ?? ""; const m = marks?.[i];
              const flip = !!g && r >= flipFrom;
              return <div key={i} role="gridcell" aria-label={ch ? `${ch}${m ? ", " + MARK_LABEL[m] : ""}` : "empty"} className={`pz-tile${m ? " " + m : ""}${ch && !g ? " typed" : ""}${flip ? " flip" : ""}`} style={{ ["--i" as string]: i }}>
                <span key={ch}>{ch}</span>
              </div>;
            })}
          </div>
        ))}
      </div>

      <p className="pz-msg" role="status">{msg}</p>

      {status === "playing" ? (
        <>
          <div className="pz-kb" role="group" aria-label="Keyboard">
            {ROWS.map((row, ri) => (
              <div key={row} className="pz-kr">
                {ri === 2 && <button className="pz-key wide" onClick={() => void submit()}>Enter</button>}
                {[...row].map(k => <button key={k} className={`pz-key${keys[k] ? " " + keys[k] : ""}`} onClick={() => type(k)} aria-label={k}>{k}</button>)}
                {ri === 2 && <button className="pz-key wide" onClick={back} aria-label="Delete"><Icon.Back /></button>}
              </div>
            ))}
          </div>
          <div className="pz-hint">
            {hint === undefined ? <button className="pz-link" onClick={() => void askHint()}>Need a clue? Show the meaning</button> : hint ? <p className="sub"><b>Clue:</b> {mask(hint.simple, answer)}</p> : <p className="sub small">Looking for a clue…</p>}
          </div>
        </>
      ) : (
        <section className="pz-end card" aria-live="polite">
          <p className="pz-badge">{status === "won" ? `Got it in ${guesses.length}` : "Not this time, and that is fine"}</p>
          <h2 className="pz-answer">{answer}</h2>
          <p className="sub">{hint ? hint.simple : hint === null ? "Meaning not available offline." : "…"}</p>
          <p className="sub small">+8 coins and +8 XP for your town.</p>
          <div className="pz-actions">
            <Btn kind="soft" onClick={() => void share()}>{copied ? "Copied" : "Share the squares"}</Btn>
            <Link className="btn" href={`/word/${answer}`}>Learn this word</Link>
          </div>
          <Link className="pz-link" href="/play">More puzzles</Link>
        </section>
      )}
    </div>
  );
}
