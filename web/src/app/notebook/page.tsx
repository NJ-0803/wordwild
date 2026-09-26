"use client";
import { useMemo, useState } from "react";
import { learningDays, masteryLevel, milestones, tierOf, vault, type SenseRecord } from "@core";
import { useStore } from "@/lib/store";
import { useSense } from "@/lib/senses";
import { Card, LinkBtn } from "@/components/ui";
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
        Status: {lvl}{s && tierOf(s) === "dictionary" ? " · practice not ready yet" : <> · practise {r.lastAttemptAt ? fmt(r.due) : "when you are ready"}</>}
      </p>
      {note && <p className="sub small">Your note: {note}</p>}
      <LinkBtn href={`/learn/${encodeURIComponent(r.senseId)}`} kind="soft">Open</LinkBtn>
    </Card>
    </Reward>
  );
}

type Tab = "review" | "fresh" | "learning" | "mastered" | "pending";
const TAB_LABEL: Record<Tab, string> = { review: "Ready to review", fresh: "New", learning: "Learning", mastered: "Mastered", pending: "Waiting for a meaning" };
const DAY_NAMES = ["Today", "Tomorrow"];

export default function Notebook() {
  const { state, now, ready } = useStore();
  const tz = useMemo(() => -new Date().getTimezoneOffset(), []);
  const [tab, setTab] = useState<Tab | null>(null);
  const [showAll, setShowAll] = useState(false);
  if (!ready) return <Loading />;
  const fmt = (t: number) => { const d = Math.round((t - now()) / 86_400_000); return d <= 0 ? "ready now" : d === 1 ? "tomorrow" : `in ${d} days`; };
  const v = vault(state, now(), tz);
  const days = learningDays(state, now(), tz);
  const ms = milestones(state, now(), tz);
  const active: Tab = tab ?? (v.review.length ? "review" : v.fresh.length ? "fresh" : v.learning.length ? "learning" : v.mastered.length ? "mastered" : "pending");
  const ids = active === "pending" ? [] : v[active];
  const max = Math.max(1, ...v.schedule);
  const dayName = (i: number) => DAY_NAMES[i] ?? new Date(now() + i * 86_400_000).toLocaleDateString(undefined, { weekday: "short" });
  return (
    <div className="stack">
      <Orb size={96} label="Wordwild" />
      <h1>My Word Vault</h1>
      {v.total === 0 && <Card>No words yet. Save your first word from Today.</Card>}
      {v.total > 0 && (<>
        <Card>
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
        <Card>
          <p className="label" style={{ margin: "0 0 8px" }}>Revision this week</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, alignItems: "end", height: 84 }} role="img" aria-label={`Words due each day this week: ${v.schedule.join(", ")}`}>
            {v.schedule.map((n, i) => <div key={i} style={{ display: "grid", gap: 4, justifyItems: "center", alignContent: "end", height: "100%" }}>
              <div style={{ width: "100%", height: `${Math.max(6, (n / max) * 56)}px`, borderRadius: 8, background: n ? "linear-gradient(180deg, var(--navy-glow), var(--navy-3))" : "var(--soft)", boxShadow: n ? "0 0 12px rgba(90,130,255,.5)" : "none" }} />
              <span className="small sub" style={{ fontVariantNumeric: "tabular-nums" }}>{n}</span></div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginTop: 4 }}>{v.schedule.map((_, i) => <span key={i} className="small sub" style={{ textAlign: "center", fontSize: ".65rem" }}>{dayName(i)}</span>)}</div>
        </Card>
        <div className="chips" role="group" aria-label="Word groups">
          {(Object.keys(TAB_LABEL) as Tab[]).map(t => { const n = t === "pending" ? v.pending.length : v[t].length; return <button key={t} className="chip" aria-pressed={active === t} onClick={() => setTab(t)}>{TAB_LABEL[t]} · {n}</button>; })}
        </div>
      </>)}
      {ids.map(id => { const r = state.senses[id]; return <Row key={id} r={r} note={state.captures.find(c => c.senseId === id)?.context} fmt={fmt} due={r.lastAttemptAt > 0 && r.due <= now()} />; })}
      {active === "pending" && v.pending.map(q => <Card key={q} tone="warn"><b>{q}</b><p className="small">{state.captures.find(c => c.query === q)?.status === "unknown" ? "Not in our dictionary yet." : "Could not be checked yet."} Nothing has been guessed.</p></Card>)}
      {v.total > 0 && ids.length === 0 && active !== "pending" && <Card>Nothing here right now.</Card>}
      <Card>
        <div className="row" style={{ justifyContent: "space-between" }}><h2 style={{ margin: 0 }}>Milestones</h2><span className="sub small" style={{ flex: "0 0 auto" }}>{ms.doneCount} of {ms.all.length}</span></div>
        <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "grid", gap: 8 }}>
          {(showAll ? ms.all : ms.all.filter(m => m.done || m.id === ms.next?.id).slice(-4)).map(m => (
            <li key={m.id} className="row" style={{ justifyContent: "flex-start", gap: 10 }}>
              <span aria-hidden style={{ flex: "0 0 auto", width: 26, height: 26, borderRadius: "50%", display: "grid", placeItems: "center", border: "1px solid var(--navy-glow)", background: m.done ? "var(--navy-2)" : "transparent" }}>{m.done ? "✓" : ""}</span>
              <span style={{ flex: 1 }}><b>{m.title}</b>{!m.done && <span className="sub small"> · {m.have} of {m.need}</span>}<br /><span className="sub small">{m.detail}</span></span>
            </li>))}
        </ul>
        <button className="chip" style={{ marginTop: 10 }} onClick={() => setShowAll(x => !x)}>{showAll ? "Show fewer" : "Show all milestones"}</button>
        <p className="sub small" style={{ margin: "8px 0 0" }}>Milestones stay reached. Nothing is ever taken away.</p>
      </Card>
    </div>
  );
}
