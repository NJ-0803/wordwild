"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SENSE_BY_ID, capture, masteryLevel, recommend, recordRecommendations, worldProgress, type Recommendation } from "@core";
import { useStore } from "@/lib/store";
import { Btn, Card, LinkBtn } from "@/components/ui";
import { Onboarding } from "@/components/Onboarding";
import { GardenScene } from "@/components/GardenScene";
import { Loading, Orb } from "@/components/Companion";
import { ThinkingOrb } from "thinking-orbs";
import { useReducedMotion } from "@/lib/motion";
import { useLemmas } from "@/lib/senses";
import { useTown } from "@/lib/useTown";
import { JourneyCard } from "@/components/JourneyCard";
import { TiltCard } from "@/components/TiltCard";
import { Icon } from "@/components/Icons";

const KIND = { review: "Come back to", learn: "Learn", prerequisite: "Start with" } as const;
const STAGE = { new: 0, seen: 1, practising: 2, secure: 3 } as const;

export default function Today() {
  const { state, ready, onboarded, update, now, recovered } = useStore();
  const router = useRouter();
  const lemmas = useLemmas(Object.keys(state.senses));      // hooks before any early return
  const { view: town } = useTown();
  const reduced = useReducedMotion();
  if (!ready) return <Loading />;
  if (!onboarded) return <Onboarding />;

  const w = worldProgress(state);
  const recs = recommend(state, SENSE_BY_ID, now(), 3);
  const plants = Object.values(state.senses).map(r => ({ id: r.senseId, stage: STAGE[masteryLevel(r)] as 0 | 1 | 2 | 3, label: lemmas[r.senseId] }));
  const summary = `Your word garden: ${w.discovered} saved, ${w.practising} practising, ${w.secure} secure.`;

  const go = (r: Recommendation) => {
    update(s => {
      let n = recordRecommendations(s, [r]);
      if (!n.senses[r.senseId]) n = capture(n, { status: "found", senses: [SENSE_BY_ID[r.senseId]], source: "fixture" }, { source: "Recommended", now: now() }).state;
      return n;
    });
    const rec = state.senses[r.senseId];
    router.push(r.kind === "review" && rec && rec.lastAttemptAt > 0 ? `/practice/${r.senseId}` : `/learn/${r.senseId}`);
  };
  const townCard = (
    <Card><div className="hero"><span aria-hidden style={{ flex: "0 0 auto" }}><ThinkingOrb state={town.ripeCount > 0 ? "listening" : "weaving"} size={64} paused={reduced} /></span><div><h2>Your town</h2>
      <p className="sub" style={{ margin: 0 }}>Level {town.level} · {town.coins} coins{town.ripeCount > 0 ? ` · ${town.ripeCount} word${town.ripeCount === 1 ? "" : "s"} ready to harvest` : ""}</p>
      <p className="sub small" style={{ margin: 0 }}>Stories, orders and buildings grow from words you truly learn.</p></div></div>
      <LinkBtn href="/town">Visit the town</LinkBtn></Card>
  );
  return (
    <div className="grid g12">
      {(recovered === "reset" || recovered === "migrated") && <div className="c12">{recovered === "reset" ? <Card tone="warn">Your saved progress could not be read, so we started fresh.</Card> : <Card tone="good">Your earlier words were carried over.</Card>}</div>}
      <section className="c12 hero-band" aria-label="Today">
        <Orb state={town.ripeCount > 0 ? "listening" : "weaving"} size={120} label={town.ripeCount > 0 ? "Words are ready to harvest" : "Your words are resting"} />
        <div style={{ flex: 1 }}>
          <h1 className="display" style={{ margin: 0 }}>Today</h1>
          <p className="sub" style={{ margin: "6px 0 0", fontSize: "1.1rem" }}>{town.ripeCount > 0 ? `${town.ripeCount} word${town.ripeCount === 1 ? "" : "s"} ready to harvest. ` : ""}{w.discovered} saved · {w.practising} practising · {w.secure} secure</p>
        </div>
      </section>
      <nav className="c12 tiles" aria-label="Add a word">
        <TiltCard className="tilt-fill"><Link href="/capture" className="tile lead"><i><Icon.Plus width={30} height={30} /></i><b>Type a word</b><span>Look it up and save it</span></Link></TiltCard>
        <TiltCard className="tilt-fill"><Link href="/voice" className="tile"><i><Icon.Mic width={30} height={30} /></i><b>Ask by voice</b><span>Say what you did not understand</span></Link></TiltCard>
        <TiltCard className="tilt-fill"><Link href="/scan" className="tile"><i><Icon.Scan width={30} height={30} /></i><b>Scan a page</b><span>Tap any word in a photo</span></Link></TiltCard>
      </nav>
      <div className="c7"><JourneyCard recs={recs} /></div>
      <div className="c5 stack">{townCard}</div>
      <div className="c7"><GardenScene plants={plants} summary={summary} /><p className="sub small" style={{ margin: "10px 2px 0" }}>{w.secure === 0 ? "Nothing has sprouted yet. The first word you make secure plants a seed." : `${w.secure} secure ${w.secure === 1 ? "word has" : "words have"} grown here. Each new secure word adds growth.`}</p></div>
      <section className="c5 stack" aria-label="Suggested for you">
        <h2 style={{ fontSize: "1.5rem" }}>Suggested for you</h2>
        {recs.map(r => {
          const s = SENSE_BY_ID[r.senseId];
          if (!s) return null;     // defensive: never render a word we cannot describe
          return (
            <Card key={r.senseId + r.kind}>
              <span className="label">{KIND[r.kind]}</span>
              <h2 style={{ fontSize: "2rem", fontFamily: "var(--font-serif), Georgia, serif", fontWeight: 400, margin: "6px 0" }}>{s.lemma}</h2>
              <p className="sub">{r.reason.text}</p>
              <Btn onClick={() => go(r)} aria-label={`Start ${s.lemma}`}>Start</Btn>
            </Card>
          );
        })}
        {recs.length === 0 && <Card>You are all caught up. Save a new word any time.</Card>}
      </section>
    </div>
  );
}
