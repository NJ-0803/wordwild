"use client";
import { WordBuddy } from "./Companion";
import { useMemo } from "react";
import { dailyJourney, learningDays, milestones, SENSE_BY_ID, type Recommendation } from "@core";
import { useStore } from "@/lib/store";
import { useLemmas } from "@/lib/senses";
import { Card, LinkBtn } from "./ui";
import { Orb } from "./Companion";

/** Today's small path for one word, plus how many days you have learned. Nothing here can be lost or broken. */
export function JourneyCard({ recs }: { recs: Recommendation[] }) {
  const { state, now } = useStore();
  const tz = useMemo(() => -new Date().getTimezoneOffset(), []);
  const fresh = recs.map(r => ({ senseId: r.senseId, lemma: SENSE_BY_ID[r.senseId]?.lemma ?? "", from: "" }));
  const j = dailyJourney(state, now(), tz, fresh);
  const days = learningDays(state, now(), tz);
  const ms = milestones(state, now(), tz);
  const id = j.pick.senseId;
  const lemma = useLemmas(id ? [id] : [])[id ?? ""] ?? (id ? SENSE_BY_ID[id]?.lemma : undefined);
  const step = j.steps.find(s => !s.done);
  const href = !id ? "/capture" : !state.senses[id] ? `/learn/${encodeURIComponent(id)}` : `/practice/${encodeURIComponent(id)}`;

  return (
    <Card tone="good">
      <p className="label" style={{ margin: "0 0 6px" }}>Today&rsquo;s word journey</p>
      {!id ? (<>
        <h2 style={{ marginBottom: 6 }}>Pick a word to begin</h2>
        <p className="sub">Save a word you met today. It becomes today&rsquo;s word.</p>
        <LinkBtn href="/capture">Save a word</LinkBtn>
      </>) : (<>
        <div className="hero" style={{ alignItems: "flex-start" }}>
          <Orb state={j.complete ? "listening" : "weaving"} size={64} label={j.complete ? "Journey complete" : "Your word for today"} />
          {lemma && <WordBuddy lemma={lemma} mastery={j.complete ? "secure" : "new"} size={64} />}
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontWeight: 400, fontSize: "2rem" }}>{lemma ?? "…"}</h2>
            <p className="sub small" style={{ margin: 0 }}>{j.complete ? "You finished today's journey. Come back tomorrow for a new word." : `${j.doneCount} of 3 steps`}</p>
          </div>
        </div>
        <ol style={{ listStyle: "none", padding: 0, margin: "12px 0", display: "grid", gap: 8 }} aria-label="Steps">
          {j.steps.map(s => (
            <li key={s.id} className="row" style={{ justifyContent: "flex-start", gap: 10, opacity: s.done ? 1 : step?.id === s.id ? 1 : 0.6 }}>
              <span aria-hidden style={{ flex: "0 0 auto", width: 26, height: 26, borderRadius: "50%", display: "grid", placeItems: "center", border: "1px solid var(--navy-glow)", background: s.done ? "var(--navy-2)" : "transparent" }}>{s.done ? "✓" : ""}</span>
              <span style={{ flex: 1 }}><b>{s.label}</b> <span className="sr">{s.done ? "done" : "not done yet"}</span><br /><span className="sub small">{s.hint}</span></span>
            </li>))}
        </ol>
        {!j.complete && step && <LinkBtn href={href}>{step.id === "meet" ? "Meet the word" : step.id === "try" ? "Practise it" : "Use it in your own words"}</LinkBtn>}
      </>)}
      <div style={{ marginTop: 14 }} aria-label="Your learning days this week">
        <div className="row" style={{ justifyContent: "flex-start", gap: 6 }}>
          {days.week.map(d => <span key={d.day} title={d.learned ? "You learned this day" : "A day off"} style={{ flex: "0 0 auto", width: 22, height: 22, borderRadius: "50%", border: `1px solid ${d.today ? "var(--navy-glow)" : "var(--line)"}`, background: d.learned ? "linear-gradient(180deg, var(--navy-3), var(--navy-2))" : "transparent", boxShadow: d.learned ? "0 0 10px rgba(90,130,255,.6)" : "none" }} />)}
        </div>
        <p className="sub small" style={{ margin: "8px 0 0" }}>
          {days.total === 0 ? "Your first learning day is today." : `${days.total} learning ${days.total === 1 ? "day" : "days"} so far`}{days.inARow >= 2 ? ` · ${days.inARow} in a row` : ""}. Days off never take anything away.
        </p>
        {ms.next && <p className="sub small" style={{ margin: "4px 0 0" }}>Next: <b>{ms.next.title}</b> ({ms.next.have} of {ms.next.need})</p>}
      </div>
    </Card>
  );
}
