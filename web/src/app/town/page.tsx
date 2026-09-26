"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SCENE_REWARD, scenesFor, tierOf, type Scene } from "@core";
import { useTown } from "@/lib/useTown";
import { getSenseSync, useLemmas } from "@/lib/senses";
import { useReducedMotion } from "@/lib/motion";
import { TownSceneLazy } from "@/components/town/TownSceneLazy";
import { Loading, Orb, Reward, WordBuddy } from "@/components/Companion";
import { Btn } from "@/components/ui";
import { SceneStage } from "@/components/town/SceneStage";

type Panel = null | { kind: "orders" } | { kind: "ripe" } | { kind: "building"; id: string } | { kind: "word"; id: string } | { kind: "scene"; id: string };

const REASON: Record<string, string> = { locked: "Not unlocked yet", "not-enough-coins": "Not enough coins yet", "already-built": "Already built", "not-done": "Not finished yet", "already-claimed": "Already collected", "not-offered": "That order is not offered today" };

export default function TownPage() {
  const { view, ready, build, claim, finish, seen, hour } = useTown();
  const router = useRouter();
  const reduced = useReducedMotion();
  const [panel, setPanel] = useState<Panel>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [glow, setGlow] = useState(false);
  const prev = useRef<{ coins: number; level: number } | null>(null);
  const lemmas = useLemmas(useMemo(() => view.plots.map(p => p.senseId), [view.plots]));

  // celebrate real gains (never on first load)
  useEffect(() => {
    if (!ready) return;
    const before = prev.current; prev.current = { coins: view.coins, level: view.level };
    if (!before) return;
    if (view.level > before.level) { setToast(`Level ${view.level}! New buildings may be ready.`); }
    else if (view.coins > before.coins) { setToast(`+${view.coins - before.coins} coins`); }
    else return;
    setGlow(true); const a = setTimeout(() => setGlow(false), 3500), b = setTimeout(() => setToast(null), 3500);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [view.coins, view.level, ready]);

  if (!ready) return <div className="town"><div className="town-loading"><Loading text="Loading your town…" /></div></div>;

  const claimable = view.orders.filter(o => o.done && !o.claimed).length;
  const ripe = view.plots.filter(p => p.ripe);
  const openWord = (id: string) => {
    const p = view.plots.find(x => x.senseId === id); const s = getSenseSync(id);
    if (p?.ripe && s && tierOf(s) !== "dictionary") router.push(`/practice/${encodeURIComponent(id)}`);
    else setPanel({ kind: "word", id });
  };
  const b = panel?.kind === "building" ? view.buildings.find(x => x.id === panel.id) : null;

  return (
    <div className={`town${panel ? " sheet-open" : ""}`}>
      <div className="town-canvas">
        <TownSceneLazy buildings={view.buildings} plots={view.plots} lemmas={lemmas} motion={!reduced} hour={hour}
          selectedBuilding={panel?.kind === "building" ? panel.id : null} onBuilding={id => setPanel({ kind: "building", id })} onPlot={openWord} />
      </div>

      <header className="hud" aria-label="Your town">
        <Link href="/" className="hud-back" aria-label="Back to Today">‹</Link>
        <div className="hud-level" aria-label={`Level ${view.level}, ${view.xpToNext} points to the next level. Levels only go up.`} title={`${view.xpToNext} points to level ${view.level + 1}`}>
          <span className="lv">{view.level}</span>
          <span className="bar"><i style={{ width: `${Math.round(view.levelProgress * 100)}%` }} /></span>
        </div>
        <div style={{ width: 56, height: 56 }} aria-hidden={false}><Orb state={ripe.length > 0 ? "listening" : "weaving"} size={56} label={ripe.length > 0 ? "Words are ready" : "Town is calm"} /></div>
        <Reward on={glow} colorVariant="sunset"><div className="hud-coins" aria-label={`${view.coins} coins`}><span className="coin" aria-hidden />{view.coins}</div></Reward>
      </header>
      {toast && <div className="town-toast" role="status">{toast}</div>}

      <nav className="dock" aria-label="Town actions">
        <button onClick={() => setPanel({ kind: "orders" })} aria-label={`Orders, ${claimable} ready to collect`}><span aria-hidden>📋</span>Orders{claimable > 0 && <b className="dot">{claimable}</b>}</button>
        <button onClick={() => setPanel({ kind: "ripe" })} aria-label={`${ripe.length} words ready to harvest`}><span aria-hidden>🌾</span>Harvest{ripe.length > 0 && <b className="dot">{ripe.length}</b>}</button>
        <button onClick={() => setPanel({ kind: "building", id: (view.buildings.find(x => x.status === "ready") ?? view.buildings.find(x => x.status !== "built") ?? view.buildings[0]).id })}><span aria-hidden>🏗️</span>Build</button>
        <Link href="/capture" className="dockbtn"><span aria-hidden>🌱</span>Plant</Link>
      </nav>

      {panel && (
        <div className="sheet-back" onClick={() => setPanel(null)}>
          <section className="sheet" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <button className="sheet-x" onClick={() => setPanel(null)} aria-label="Close">×</button>

            {panel.kind === "orders" && (<>
              <h2>Today&apos;s orders</h2>
              <p className="sub small">New orders arrive every day. Skipped ones simply go away. Nothing is lost.</p>
              <ul className="orders">{view.orders.map(o => (
                <li key={o.ref}>
                  <Reward on={o.done && !o.claimed} colorVariant="ocean">
                    <div className="order">
                      <div className="hero" style={{ gap: 10 }}><div style={{ flex: "0 0 auto" }}><WordBuddy lemma={o.giver} size={44} /></div><div><b>{o.giver}</b><p style={{ margin: 0 }}>{o.line}</p></div></div>
                      <div className="prog" aria-label={`${Math.min(o.progress, o.target)} of ${o.target} ${o.unit}`}><i style={{ width: `${Math.min(100, (o.progress / o.target) * 100)}%` }} /></div>
                      <div className="row"><span className="sub small">{Math.min(o.progress, o.target)} / {o.target} {o.unit}</span><span className="small"><b>+{o.coins}</b> coins · <b>+{o.xp}</b> XP</span></div>
                      {o.claimed ? <p className="small" style={{ margin: 0 }}><b>Collected ✓</b></p> : <Btn disabled={!o.done} onClick={() => { const r = claim(o.ref); if (!r.ok) setToast(REASON[r.reason] ?? "Not now"); }}>{o.done ? "Collect reward" : "Keep going"}</Btn>}
                    </div>
                  </Reward>
                </li>))}
              </ul>
            </>)}

            {panel.kind === "ripe" && (<>
              <h2>Ready to harvest</h2>
              <p className="sub small">Reviewing a ripe word is the harvest. Words rest between reviews and never wilt.</p>
              {ripe.length === 0 ? <p>Nothing is ripe right now. Come back later, or plant a new word.</p> : (
                <ul className="orders">{ripe.map(p => (
                  <li key={p.senseId}><div className="order"><div className="hero" style={{ gap: 10 }}><div style={{ flex: "0 0 auto" }}><WordBuddy lemma={lemmas[p.senseId] ?? "word"} due size={44} /></div><b style={{ fontSize: "1.2rem" }}>{lemmas[p.senseId] ?? "…"}</b></div>
                    <Btn onClick={() => { setPanel(null); openWord(p.senseId); }}>{p.firstTime ? "Plant it: first practice" : "Harvest"}</Btn></div></li>))}</ul>)}
            </>)}

            {panel.kind === "word" && (() => { const p = view.plots.find(x => x.senseId === panel.id); const d = p ? Math.round(p.dueInMs / 86_400_000) : 0; return (<>
              <h2>{lemmas[panel.id] ?? "Word"}</h2>
              <p>{p?.ripe ? "This word is ripe. Practice for it is not ready yet. Open the word to prepare it." : `Resting. It will be ripe ${d <= 0 ? "soon" : d === 1 ? "tomorrow" : `in ${d} days`}.`}</p>
              <Btn onClick={() => router.push(`/learn/${encodeURIComponent(panel.id)}`)}>Open the word</Btn></>); })()}

            {panel.kind === "scene" && (() => { const sc = scenesFor(view.buildings.find(x => x.status === "built" && scenesFor(x.id).some(y => y.id === panel.id))?.id ?? "").find(y => y.id === panel.id); if (!sc) return <p>This scene is not available yet.</p>; return (<>
              <h2>{sc.title}</h2><p className="sub small" style={{ marginTop: -6 }}>Words in this scene: {sc.focus}. Story drafts are not yet checked by a language editor.</p>
              <SceneStage key={sc.id} scene={sc} done={seen.has(sc.id)} onFinish={() => { const r = finish(sc.id); if (r.ok) { setToast(`Scene finished: +${SCENE_REWARD.coins} coins`); setGlow(true); setTimeout(() => setGlow(false), 3500); setPanel({ kind: "building", id: sc.building }); } }} />
            </>); })()}

            {b && (<>
              <h2>{b.name}</h2><p className="sub small" style={{ marginTop: -6 }}>Chapter: {b.chapter}</p>
              <p>{b.story}</p>
              {b.status === "built" && <p><b>Built ✓</b> Save words about {b.topics.join(", ")} and they will belong here.</p>}
              {b.status === "locked" && <p>Reach <b>level {b.unlockLevel}</b> to unlock this. Levels come from words you truly learn.</p>}
              {b.status === "saving" && <p>You need <b>{b.needCoins} more coins</b>. Coins come from learning words, not from waiting.</p>}
              {b.status === "ready" && <Btn onClick={() => { const r = build(b.id); if (r.ok) { setToast(`${b.name} built!`); setGlow(true); setTimeout(() => setGlow(false), 3500); setPanel(null); } else setToast(REASON[r.reason] ?? "Not now"); }}>Build for {b.cost} coins</Btn>}
              {b.status === "built" && scenesFor(b.id).length > 0 && (<div style={{ display: "grid", gap: 8, margin: "10px 0" }}>
                {scenesFor(b.id).map((sc: Scene) => (<Reward key={sc.id} on={!seen.has(sc.id)} colorVariant="sunset"><button className="order" style={{ textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit", width: "100%" }} onClick={() => setPanel({ kind: "scene", id: sc.id })}>
                  <b>📖 {sc.title}</b><span className="sub small">{seen.has(sc.id) ? "Seen ✓ · replay any time" : `A short story · +${SCENE_REWARD.coins} coins the first time`}</span></button></Reward>))}
              </div>)}
              <div className="row" style={{ marginTop: 10 }}>{view.buildings.map(x => <button key={x.id} className="chip" aria-pressed={x.id === b.id} onClick={() => setPanel({ kind: "building", id: x.id })}>{x.name}</button>)}</div>
            </>)}
          </section>
        </div>
      )}
    </div>
  );
}
