"use client";
import { Icon } from "@/components/Icons";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BUILDING_BY_ID, POINTS, scenesFor, type Scene } from "@core";
import { useTown } from "@/lib/useTown";
import { useReducedMotion } from "@/lib/motion";
import { TownSceneLazy } from "@/components/town/TownSceneLazy";
import { Loading, Reward } from "@/components/Companion";
import { SceneStage } from "@/components/town/SceneStage";

type Panel = null | { kind: "plan" } | { kind: "piece"; id: string } | { kind: "scene"; id: string };
const SEEN_KEY = "ww.town.seen";

export default function TownPage() {
  const { view, ready, finish, seen, hour } = useTown();
  const reduced = useReducedMotion();
  const [panel, setPanel] = useState<Panel>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string[]>([]);
  const [glow, setGlow] = useState(false);
  const started = useRef(false);

  // Pieces built since the last visit rise out of the ground and are announced. The first ever visit announces nothing.
  useEffect(() => {
    if (!ready || started.current) return; started.current = true;
    let before: string[] | null = null; try { const raw = localStorage.getItem(SEEN_KEY); before = raw ? (JSON.parse(raw) as string[]) : null; } catch { /* first visit */ }
    const ids = view.built.map(p => p.id); const added = before ? ids.filter(id => !before!.includes(id)) : [];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the last visit from storage is syncing with an external system
    if (added.length) { setFresh(added); const names = view.built.filter(p => added.includes(p.id)).map(p => p.name); setToast(added.length === 1 ? `New in your town: ${names[0]}` : `${added.length} new pieces: ${names.slice(0, 3).join(", ")}${added.length > 3 ? "…" : ""}`); setGlow(true); }
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(ids)); } catch { /* memory only */ }
    const a = setTimeout(() => setGlow(false), 4000), b = setTimeout(() => setToast(null), 5000);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [ready, view.built]);
  // while the page is open, a newly earned piece is announced too
  const count = useRef<number | null>(null);
  useEffect(() => {
    if (!ready) return; const n = view.built.length; const was = count.current; count.current = n;
    if (was === null || n <= was) return;
    const added = view.built.slice(was).map(p => p.id);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to a real gain
    setFresh(f => [...f, ...added]); setToast(`New in your town: ${view.built[n - 1].name}`); setGlow(true);
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(view.built.map(p => p.id))); } catch { /* memory only */ }
    const a = setTimeout(() => setGlow(false), 4000), b = setTimeout(() => setToast(null), 5000); return () => { clearTimeout(a); clearTimeout(b); };
  }, [view.built, ready]);

  const piece = panel?.kind === "piece" ? view.pieces.find(x => x.id === panel.id) : null;
  const civic = piece?.civic ? view.buildings.find(b => b.id === piece.civic) : null;
  const scenes = useMemo(() => (civic ? scenesFor(civic.id) : []), [civic]);
  if (!ready) return <div className="town"><div className="town-loading"><Loading text="Loading your town…" /></div></div>;

  return (
    <div className={`town${panel ? " sheet-open" : ""}`}>
      <div className="town-canvas">
        <TownSceneLazy pieces={view.pieces} sectors={view.sectors} points={view.points} fresh={fresh} motion={!reduced} hour={hour} selected={panel?.kind === "piece" ? panel.id : null} onPiece={id => setPanel({ kind: "piece", id })} />
      </div>

      <header className="hud" aria-label="Your town">
        <Link href="/" className="hud-back" aria-label="Back to Today">‹</Link>
        <Reward on={glow} colorVariant="sunset">
          <button className="hud-town" onClick={() => setPanel({ kind: "plan" })} aria-label={`${view.title}, ${view.size} pieces. ${view.next ? `${view.toNext} points to ${view.next.name}.` : "Your city is complete."} Open the plan.`}>
            <b>{view.title}</b>
            <span className="bar"><i style={{ transform: `scaleX(${Math.max(0.03, view.progress)})`, width: "100%" }} /></span>
            <small>{view.next ? `${view.toNext} points to ${view.next.name}` : "Your city is complete"}</small>
          </button>
        </Reward>
        <div className="hud-coins" aria-label={`${view.points} points`}><span className="coin" aria-hidden />{view.points}</div>
      </header>
      {toast && <div className="town-toast" role="status">{toast}</div>}

      <nav className="dock" aria-label="Town actions">
        <button onClick={() => setPanel({ kind: "plan" })}><span aria-hidden><Icon.Town /></span>City plan</button>
        <button onClick={() => { const b = view.buildings.find(x => x.status === "built" && scenesFor(x.id).length); if (b) { const p = view.pieces.find(x => x.civic === b.id); if (p) setPanel({ kind: "piece", id: p.id }); } }}><span aria-hidden><Icon.Book /></span>Stories</button>
        <Link href="/capture" className="dockbtn"><span aria-hidden><Icon.Plus /></span>Add a word</Link>
        <Link href="/play" className="dockbtn"><span aria-hidden><Icon.Puzzle /></span>Puzzles</Link>
      </nav>

      {panel && (
        <div className="sheet-back" onClick={() => setPanel(null)}>
          <section className="sheet" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <button className="sheet-x" onClick={() => setPanel(null)} aria-label="Close">×</button>

            {panel.kind === "plan" && (<>
              <h2>Your city plan</h2>
              <p className="sub small">Every word you log builds your town. A saved word is worth {POINTS.saved} points, practising it {POINTS.practised} more, making it secure {POINTS.secure} more, and a puzzle {POINTS.puzzle}. Nothing is spent, and the town never shrinks.</p>
              <h3 className="plan-h">Next up</h3>
              <ol className="plan">
                {view.upcoming.map((p, i) => (
                  <li key={p.id} className={i === 0 ? "next" : "later"}><button disabled><span className="plan-dot" aria-hidden /><span className="plan-name"><b>{p.name}</b><small>{i === 0 ? `Next · ${p.at - view.points} more points` : `${p.at} points`}</small></span></button></li>))}
              </ol>
              <h3 className="plan-h">Built · {view.built.length} pieces</h3>
              <ol className="plan">
                {[...view.built].reverse().slice(0, 14).map(p => (
                  <li key={p.id} className="built"><button onClick={() => setPanel({ kind: "piece", id: p.id })}><span className="plan-dot" aria-hidden><Icon.Check /></span><span className="plan-name"><b>{p.name}</b><small>{p.blurb}</small></span></button></li>))}
              </ol>
              {view.built.length > 14 && <p className="sub small">…and {view.built.length - 14} more. Your city is {view.sectors.length === 1 ? "one sector" : `${view.sectors.length} sectors`} wide, and it keeps growing with every word.</p>}
            </>)}

            {panel.kind === "scene" && (() => { const sc = view.buildings.flatMap(b => scenesFor(b.id)).find(y => y.id === panel.id); if (!sc) return <p>This scene is not available yet.</p>; return (<>
              <h2>{sc.title}</h2><p className="sub small" style={{ marginTop: -6 }}>Words in this scene: {sc.focus}. Story drafts are not yet checked by a language editor.</p>
              <SceneStage key={sc.id} scene={sc} done={seen.has(sc.id)} onFinish={() => { const r = finish(sc.id); if (r.ok) { setToast(`Scene finished: +${POINTS.scene} town points`); setGlow(true); setTimeout(() => setGlow(false), 3500); const p = view.pieces.find(x => x.civic === sc.building); setPanel(p ? { kind: "piece", id: p.id } : null); } }} />
            </>); })()}

            {piece && (<>
              <h2>{piece.name}</h2>
              <p className="sub small" style={{ marginTop: -6 }}>{civic ? `Chapter: ${civic.chapter}` : piece.kind === "house" ? "A home in your town" : piece.kind === "farm" ? "Farm and seeds" : piece.kind === "park" ? "Park and square" : piece.kind === "shop" ? "Shop" : "Landmark"}</p>
              <p>{civic ? BUILDING_BY_ID[civic.id].story : piece.blurb}</p>
              {civic && <p className="sub small">Save words about {civic.topics.join(", ")} and they belong here.</p>}
              {civic && scenes.length > 0 && (<div style={{ display: "grid", gap: 8, margin: "10px 0" }}>
                {scenes.map((sc: Scene) => (<Reward key={sc.id} on={!seen.has(sc.id)} colorVariant="sunset"><button className="order" style={{ textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit", width: "100%" }} onClick={() => setPanel({ kind: "scene", id: sc.id })}>
                  <b><Icon.Book style={{ verticalAlign: "-3px", marginRight: 6 }} />{sc.title}</b><span className="sub small">{seen.has(sc.id) ? "Seen · replay any time" : `A short story · +${POINTS.scene} town points the first time`}</span></button></Reward>))}
              </div>)}
              <button className="chip" onClick={() => setPanel({ kind: "plan" })}>See the whole plan</button>
            </>)}
          </section>
        </div>
      )}
    </div>
  );
}
