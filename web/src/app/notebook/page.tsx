"use client";
import { useMemo, useState } from "react";
import { learningDays, masteryLevel, milestones, reviewQueue, tierOf, townView, vault, type SenseRecord } from "@core";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { WordForYou } from "@/components/WordForYou";
import { useStore } from "@/lib/store";
import { useSense } from "@/lib/senses";
import { Icon } from "@/components/Icons";
import { Card, Field, LinkBtn } from "@/components/ui";
import { Loading, Orb, Reward, WordBuddy } from "@/components/Companion";
import { ShareButton } from "@/components/ShareButton";
import { getSenseSync } from "@/lib/senses";

function Row({ r, note, fmt, due }: { r: SenseRecord; note?: string; fmt: (t: number) => string; due: boolean }) {
  const s = useSense(r.senseId);
  const lvl = masteryLevel(r);
  return (
    <Reward on={lvl === "secure"} colorVariant="mono">
    <Card>
      <div className="hero">{s && <div style={{ flex: "0 0 auto" }}><WordBuddy lemma={s.lemma} mastery={lvl} due={due} size={52} /></div>}
      <h2 style={{ margin: 0 }}>{s ? s.lemma : "…"} {s && <span className="pill">{s.pos}</span>}</h2></div>
      <p className="sub">{s === undefined ? "Loading…" : s === null ? "Not available offline yet. Open it once while online." : s.simple}</p>
      <p className="sub small">
        {lvl === "secure" ? "Secure" : lvl === "practising" ? "Practising" : "Saved"}{s && tierOf(s) === "dictionary" ? " · included in your reviews, checked practice coming soon" : <> · practise {r.lastAttemptAt ? fmt(r.due) : "when you are ready"}</>}
      </p>
      {note && <p className="sub small">Your note: {note}</p>}
      <LinkBtn href={`/learn/${encodeURIComponent(r.senseId)}`} kind="soft">{s && tierOf(s) === "dictionary" ? "Explore word" : "Open"}</LinkBtn>
    </Card>
    </Reward>
  );
}

type Tab = "review" | "fresh" | "learning" | "mastered" | "pending";
const TAB_LABEL: Record<Tab, string> = { review: "Ready to review", fresh: "Saved", learning: "Practising", mastered: "Secure", pending: "Waiting for a meaning" };

export default function Notebook() {
  const { state, now, ready } = useStore();
  const { user } = useUser();
  const tz = useMemo(() => -new Date().getTimezoneOffset(), []);
  const [tab, setTab] = useState<Tab | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [q, setQ] = useState("");
  if (!ready) return <Loading />;
  const fmt = (t: number) => { const d = Math.round((t - now()) / 86_400_000); return d <= 0 ? "ready now" : d === 1 ? "tomorrow" : `in ${d} days`; };
  const v = vault(state, now(), tz);
  const days = learningDays(state, now(), tz);
  const ms = milestones(state, now(), tz);
  const view = townView(state, now(), tz);
  const queue = reviewQueue(state, now(), 5);
  const hour = new Date(now()).getHours(); const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const laterCount = v.schedule.slice(2).reduce((a, b) => a + b, 0);
  const title = view.level >= 10 ? "Word Sage" : view.level >= 7 ? "Wordsmith" : view.level >= 4 ? "Word Explorer" : view.level >= 2 ? "Sprout" : "Seedling";
  const weekDays = days.week.filter(d => d.learned).length;
  const active: Tab = tab ?? (v.review.length ? "review" : v.fresh.length ? "fresh" : v.learning.length ? "learning" : v.mastered.length ? "mastered" : "pending");
  const ids = (active === "pending" ? [] : v[active]).filter(id => !q.trim() || (getSenseSync(id)?.lemma ?? "").toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="grid g12">
      <div className="c12 hero-band"><Orb size={96} label="Wordwild" /><h1 className="display" style={{ margin: 0 }}>My words</h1></div>
      {v.total > 0 && <div className="c12"><section className="card good nb-today" aria-label="Today">
        <div>
          <p className="label" style={{ margin: 0 }}>{greet}{user?.firstName ? `, ${user.firstName}` : ""}</p>
          <h2 className="nb-today-h">{queue.length ? "Your review is ready." : "You are all caught up."}</h2>
          <p className="sub" style={{ margin: 0 }}>{queue.length ? `${[v.review.length ? `${v.review.length} ${v.review.length === 1 ? "word is" : "words are"} ready` : "", v.fresh.length ? `${v.fresh.length} saved ${v.fresh.length === 1 ? "word is" : "words are"} waiting for a first look` : ""].filter(Boolean).join(", and ")}. It takes about ${Math.max(1, Math.round(queue.length * 0.6))} ${Math.max(1, Math.round(queue.length * 0.6)) === 1 ? "minute" : "minutes"}.` : "Nothing is due. Save a word, or play today's puzzles."}{weekDays > 0 ? ` You learned on ${weekDays} of the last 7 days.` : ""}</p>
        </div>
        {queue.length > 0 ? <Link href="/review" className="btn nb-cta">Start review · {queue.length} {queue.length === 1 ? "word" : "words"}</Link> : <Link href="/play" className="btn soft nb-cta">Play a puzzle</Link>}
      </section></div>}
      {v.total > 0 && <div className="c6"><Card>
        <p className="label" style={{ margin: 0 }}>Your level</p>
        <h2 style={{ margin: "4px 0 8px" }}>Level {view.level} · {title}</h2>
        <div className="rv-bar" role="img" aria-label={`${Math.round(view.levelProgress * 100)} percent to the next level`}><i style={{ transform: `scaleX(${Math.max(0.03, view.levelProgress)})` }} /></div>
        <p className="sub small" style={{ margin: "8px 0 0" }}>{view.xpToNext} XP to level {view.level + 1}. Saving, practising and puzzles all count.</p>
      </Card></div>}
      {v.total > 0 && <div className="c6"><Card>
        <p className="label" style={{ margin: 0 }}>Review schedule</p>
        <ul className="nb-when" aria-label="Words due">
          <li><b>{v.schedule[0]}</b><span>Today</span></li><li><b>{v.schedule[1]}</b><span>Tomorrow</span></li><li><b>{laterCount}</b><span>This week</span></li>
        </ul>
      </Card></div>}
      {v.total > 0 && <div className="c12"><WordForYou /></div>}
      {v.total === 0 && <div className="c12"><Card>Your library is empty for now. Save a word you met today and it will be waiting here, with a plan for when to revisit it.</Card></div>}
      {v.total > 0 && (<>
        <div className="c12"><Card>
          <div className="row" style={{ alignItems: "stretch" }}>
            <div><p className="label" style={{ margin: 0 }}>Saved</p><p style={{ fontSize: "1.8rem", margin: 0, fontVariantNumeric: "tabular-nums" }}>{Object.keys(state.senses).length}</p></div>
            <div><p className="label" style={{ margin: 0 }}>You own</p><p style={{ fontSize: "1.8rem", margin: 0, fontVariantNumeric: "tabular-nums" }}>{v.mastered.length}</p></div>
            <div><p className="label" style={{ margin: 0 }}>Learning days</p><p style={{ fontSize: "1.8rem", margin: 0, fontVariantNumeric: "tabular-nums" }}>{days.total}</p></div>
          </div>
          <p className="sub small" style={{ margin: "8px 0 0" }}>&ldquo;You own&rdquo; means secure: words you can really use, not just words you have seen.</p>
          <div style={{ marginTop: 10 }}><ShareButton kind="vault" filename="my-words.png" text="My words on Wordwild" label="Share my words as a card" spec={() => {
            const pick = [...v.mastered, ...v.learning, ...v.review, ...v.fresh].slice(0, 4).map(id => { const s = getSenseSync(id); return { text: s?.lemma ?? "", sub: s?.simple }; }).filter(l => l.text);
            return { kicker: "My Wordwild", title: "Words I am learning", stats: [{ value: String(Object.keys(state.senses).length), label: "saved" }, { value: String(v.mastered.length), label: "I own" }, { value: String(days.total), label: "learning days" }], lines: pick, footer: "wordwild-seven.vercel.app" };
          }} /></div>
        </Card>
        </div>
        <div className="c12 chips" role="group" aria-label="Word groups">
          {(Object.keys(TAB_LABEL) as Tab[]).map(t => { const n = t === "pending" ? v.pending.length : v[t].length; return <button key={t} className="chip" aria-pressed={active === t} onClick={() => setTab(t)}>{TAB_LABEL[t]} · {n}</button>; })}
        </div>
      </>)}
      {v.total > 0 && <div className="c12"><Field><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search your words" aria-label="Search your words" style={{ width: "100%", minHeight: 52, padding: "0 16px", borderRadius: 16, border: "1px solid var(--line)", fontSize: "1rem" }} /></Field></div>}
      <div className="c12 cards">{ids.map(id => { const r = state.senses[id]; return <Row key={id} r={r} note={state.captures.find(c => c.senseId === id)?.context} fmt={fmt} due={r.lastAttemptAt > 0 && r.due <= now()} />; })}</div>
      {active === "pending" && <div className="c12 cards">{v.pending.map(q => <Card key={q} tone="warn"><b>{q}</b><p className="small">{state.captures.find(c => c.query === q)?.status === "unknown" ? "Not in our dictionary yet." : "Could not be checked yet."} Nothing has been guessed.</p></Card>)}</div>}
      {v.total > 0 && ids.length === 0 && active !== "pending" && <div className="c12"><Card>Nothing here right now.</Card></div>}
      <div className="c12"><Card>
        <div className="row" style={{ justifyContent: "space-between" }}><h2 style={{ margin: 0 }}>Your vocabulary journey</h2><span className="sub small" style={{ flex: "0 0 auto" }}>{ms.doneCount} of {ms.all.length}</span></div>
        <ol className="nb-path" aria-label="Milestones">
          {(showAll ? ms.all : ms.all.filter(m => m.done || m.id === ms.next?.id).slice(-5)).map(m => (
            <li key={m.id} className={m.done ? "done" : "next"}>
              <span className="nb-dot" aria-hidden>{m.done ? <Icon.Check /> : null}</span>
              <span><b>{m.title}</b>{!m.done && <span className="sub small"> · {m.have} of {m.need}</span>}<br /><span className="sub small">{m.detail}</span></span>
            </li>))}
        </ol>
        <button className="chip" style={{ marginTop: 10 }} onClick={() => setShowAll(x => !x)}>{showAll ? "Show fewer" : "Show the whole journey"}</button>
        <p className="sub small" style={{ margin: "8px 0 0" }}>Milestones stay reached. Nothing is ever taken away.</p>
      </Card></div>
    </div>
  );
}
