"use client";
import { useRouter } from "next/navigation";
import { SENSE_BY_ID, capture, masteryLevel, recommend, recordRecommendations, worldProgress, type Recommendation } from "@core";
import { useStore } from "@/lib/store";
import { Btn, Card, LinkBtn } from "@/components/ui";
import { Onboarding } from "@/components/Onboarding";
import { GardenScene } from "@/components/GardenScene";
import { Loading, Lumi, Orb } from "@/components/Companion";
import { ThinkingOrb } from "thinking-orbs";
import { useReducedMotion } from "@/lib/motion";
import { useLemmas } from "@/lib/senses";
import { useTown } from "@/lib/useTown";
import { JourneyCard } from "@/components/JourneyCard";

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
  const gardenCard = (
    <Card tone="good">
      <div className="hero"><Lumi mood={w.secure > 0 ? "working" : "default"} size={64} />
        <div><h2>Your word garden</h2><p className="sub" style={{ margin: 0 }}>{w.discovered} saved · {w.practising} practising · {w.secure} secure</p>
          <p className="sub small" style={{ margin: 0 }}>Plants grow when a word is secure, not just saved.</p></div></div>
    </Card>
  );
  return (
    <div className="stack">
      {recovered === "reset" && <Card tone="warn">Your saved progress could not be read, so we started fresh.</Card>}
      {recovered === "migrated" && <Card tone="good">Your earlier words were carried over.</Card>}
      <Orb state={town.ripeCount > 0 ? "listening" : "weaving"} size={160} label={town.ripeCount > 0 ? "Words are ready to harvest" : "Your words are resting"} />
      <h1 style={{ textAlign: "center" }}>Today</h1>
      <GardenScene plants={plants} summary={summary} />
      <JourneyCard recs={recs} />
      {townCard}
      {gardenCard}
      <div className="row"><LinkBtn href="/capture">＋ Type a word</LinkBtn><LinkBtn href="/voice" kind="soft">🎤 Ask by voice</LinkBtn></div>
      <LinkBtn href="/scan" kind="soft">📷 Scan a page</LinkBtn>
      <h2>Suggested for you</h2>
      {recs.map(r => {
        const s = SENSE_BY_ID[r.senseId];
        if (!s) return null;     // defensive: never render a word we cannot describe
        return (
          <Card key={r.senseId + r.kind}>
            <span className="small sub">{KIND[r.kind]}</span>
            <h2 style={{ fontSize: "1.4rem" }}>{s.lemma}</h2>
            <p className="sub">{r.reason.text}</p>
            <Btn onClick={() => go(r)} aria-label={`Start ${s.lemma}`}>Start</Btn>
          </Card>
        );
      })}
      {recs.length === 0 && <Card>You are all caught up. Save a new word any time.</Card>}
    </div>
  );
}
