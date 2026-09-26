"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useStore } from "@/lib/store";
import { useReducedMotion } from "@/lib/motion";
import { Icon } from "./Icons";

const KEY = "ww.welcomed";
const EASE = [0.23, 1, 0.32, 1] as const;

interface Card { title: string; body: string; art: "save" | "meaning" | "review" | "city" }
const TOUR: Card[] = [
  { title: "Save any word you meet", body: "Type it, say it, scan a page, or select it on any website with the Chrome extension.", art: "save" },
  { title: "Understand it your way", body: "Simple meanings first, with Hindi help, real examples and a coach for how to use it.", art: "meaning" },
  { title: "A few minutes, often", body: "Words come back just when you are about to forget them. Tell us how it went; nothing is ever a test.", art: "review" },
  { title: "Watch your city grow", body: "Every word you log adds houses, seeds and parks to a city that only ever gets more beautiful.", art: "city" },
];

/** Little scenes drawn from CSS and SVG, so they cost nothing to load and match the glass look. */
function Art({ kind, active }: { kind: Card["art"]; active: boolean }) {
  const r = useReducedMotion();
  const float = (i: number) => (r || !active ? undefined : { y: [0, -8, 0], transition: { duration: 4 + i * 0.6, repeat: Infinity, ease: "easeInOut" as const, delay: i * 0.3 } });
  if (kind === "save") return (
    <div className="wl-art wl-save">
      {[["Type", <Icon.Plus key="a" />], ["Speak", <Icon.Mic key="b" />], ["Scan", <Icon.Scan key="c" />], ["Chrome", <Icon.Plug key="d" />]].map(([l, ic], i) => (
        <motion.div key={String(l)} className="wl-chip" animate={float(i)}><span>{ic}</span>{l}</motion.div>))}
      <motion.div className="wl-word" animate={float(4)}>serendipity</motion.div>
    </div>);
  if (kind === "meaning") return (
    <div className="wl-art wl-mean">
      <motion.div className="wl-mcard" animate={float(0)}><b>serendipity</b><span>good luck in making unexpected and fortunate discoveries</span></motion.div>
      <motion.div className="wl-mcard hi" animate={float(2)} lang="hi"><span>अनजाने में मिली अच्छी किस्मत</span></motion.div>
    </div>);
  if (kind === "review") return (
    <div className="wl-art wl-rev">
      <motion.div className="wl-rword" animate={float(0)}>ephemeral</motion.div>
      <div className="wl-rbtns">{["I know it", "Almost", "I forgot"].map((t, i) => <motion.span key={t} animate={float(i + 1)}>{t}</motion.span>)}</div>
    </div>);
  return (
    <div className="wl-art wl-city" aria-hidden>
      {[["#f3a7a2", "#dc4a3d", 0], ["#f7cf5f", "#ec8a3c", 1], ["#83b7ea", "#4f5f80", 2], ["#f5e6be", "#2f9089", 3], ["#f3a7a2", "#c9673f", 4]].map(([w, roof, i]) => (
        <motion.div key={String(i)} className="wl-house" style={{ ["--w" as string]: w, ["--r" as string]: roof, left: `${8 + Number(i) * 18}%`, bottom: `${(Number(i) % 2) * 22 + 10}%` }}
          initial={r ? false : { scale: 0, y: 30 }} animate={active ? { scale: 1, y: 0 } : { scale: 0.6, y: 20 }} transition={{ type: "spring", stiffness: 260, damping: 18, delay: active ? 0.15 * Number(i) : 0 }}><i /></motion.div>))}
      <div className="wl-road" />
    </div>);
}

/** The very first screen. A glass welcome with a signature, a spatial tour, and one big Start that flows into Today. Shown once per device. */
export function Welcome() {
  const { onboarded, ready } = useStore();
  const reduced = useReducedMotion();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);            // 0 signature, 1-4 tour, 5 start
  const px = useMotionValue(0), py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 60, damping: 20 }), sy = useSpring(py, { stiffness: 60, damping: 20 });
  const bx = useTransform(sx, v => v * -22), by = useTransform(sy, v => v * -16), fx = useTransform(sx, v => v * 10), fy = useTransform(sy, v => v * 8);
  const drag = useRef(0);

  useEffect(() => {
    if (!ready) return;
    let seen = false; try { seen = localStorage.getItem(KEY) === "1"; } catch { /* first visit */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a one-time flag from storage
    if (!onboarded && !seen) { setShow(true); document.documentElement.dataset.welcome = "1"; } else { delete document.documentElement.dataset.welcome; }
  }, [ready, onboarded]);

  const finish = useCallback(() => { try { localStorage.setItem(KEY, "1"); } catch { /* memory only */ } setShow(false); delete document.documentElement.dataset.welcome; }, []);
  const go = useCallback((n: number) => setStep(s => Math.max(0, Math.min(5, typeof n === "number" ? n : s))), []);
  useEffect(() => {
    if (!show) return;
    const on = (e: KeyboardEvent) => { if (e.key === "ArrowRight") setStep(s => Math.min(5, s + 1)); else if (e.key === "ArrowLeft") setStep(s => Math.max(0, s - 1)); else if (e.key === "Enter" && step === 5) finish(); else if (e.key === "Escape") setStep(5); };
    window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on);
  }, [show, step, finish]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div className="wl" role="dialog" aria-modal="true" aria-label="Welcome to Wordwild"
          initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.07, filter: "blur(18px)", transition: { duration: reduced ? 0.01 : 0.6, ease: EASE } }}
          onPointerMove={e => { px.set(e.clientX / window.innerWidth - 0.5); py.set(e.clientY / window.innerHeight - 0.5); }}>
          <motion.div className="wl-orb o1" style={{ x: bx, y: by }} /><motion.div className="wl-orb o2" style={{ x: fx, y: fy }} /><motion.div className="wl-orb o3" style={{ x: bx, y: fy }} />
          <div className="wl-grain" aria-hidden />

          {step < 5 && <button className="wl-skip" onClick={() => setStep(5)}>Skip tour</button>}

          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="sig" className="wl-sig" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -24, filter: "blur(10px)", transition: { duration: 0.35, ease: EASE } }}>
                <motion.div className="wl-glass wl-sigbox" style={{ x: fx, y: fy }} initial={reduced ? false : { scale: 0.92, y: 30, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} transition={{ duration: 0.9, ease: EASE }}>
                  <p className="wl-kicker">Welcome to Wordwild</p>
                  <div className="wl-nj" aria-label="NJ">
                    <motion.span initial={reduced ? false : { clipPath: "inset(-15% 100% -15% -10%)" }} animate={{ clipPath: "inset(-15% -30% -15% -10%)" }} transition={{ duration: 1.5, delay: 0.5, ease: [0.5, 0, 0.2, 1] }}>NJ</motion.span>
                    <svg viewBox="0 0 320 40" className="wl-flourish" aria-hidden><motion.path d="M6 26 C 60 8, 120 34, 190 18 S 290 10, 314 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, delay: 1.7, ease: EASE }} /></svg>
                  </div>
                  <p className="wl-line">Learn the words you meet, and watch a city grow from them.</p>
                  <motion.button className="wl-pill" onClick={() => setStep(1)} whileTap={{ scale: 0.97 }} initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.2, duration: 0.5, ease: EASE }}>Take the tour <Icon.ArrowLeft style={{ transform: "rotate(180deg)" }} /></motion.button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {step >= 1 && step <= 4 && (
            <div className="wl-stage" style={{ perspective: 1400 }}>
              {TOUR.map((c, i) => {
                const off = i - (step - 1); const abs = Math.abs(off); if (abs > 2) return null;
                return (
                  <motion.article key={c.title} className="wl-glass wl-card" aria-hidden={off !== 0}
                    initial={false}
                    animate={{ x: off * 62 + "%", z: -abs * 220, rotateY: off * -26, scale: 1 - abs * 0.06, opacity: abs > 1 ? 0 : 1 - abs * 0.45, filter: `blur(${abs * 3}px)` }}
                    transition={reduced ? { duration: 0.01 } : { type: "spring", stiffness: 110, damping: 20 }}
                    drag={off === 0 ? "x" : false} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.25}
                    onDragStart={() => { drag.current = 0; }} onDrag={(_, i2) => { drag.current = i2.offset.x; }}
                    onDragEnd={() => { if (drag.current < -60) setStep(s => Math.min(5, s + 1)); else if (drag.current > 60) setStep(s => Math.max(0, s - 1)); }}
                    style={{ pointerEvents: off === 0 ? "auto" : "none" }}>
                    <Art kind={c.art} active={off === 0} />
                    <h2>{c.title}</h2><p>{c.body}</p>
                  </motion.article>);
              })}
            </div>
          )}

          {step === 5 && (
            <motion.div className="wl-start" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, ease: EASE }}>
              <motion.button className="wl-big" onClick={finish} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} animate={reduced ? undefined : { boxShadow: ["0 30px 80px -20px rgba(110,130,255,.45)", "0 40px 110px -20px rgba(110,130,255,.75)", "0 30px 80px -20px rgba(110,130,255,.45)"] }} transition={{ duration: 3.2, repeat: Infinity }}>Start</motion.button>
              <p className="wl-line">It takes a minute. No test, no timers.</p>
            </motion.div>
          )}

          {step >= 1 && step <= 4 && (
            <div className="wl-nav">
              <button className="wl-pill quiet" onClick={() => go(step - 1)} aria-label="Back"><Icon.ArrowLeft /></button>
              <div className="wl-dots" role="tablist" aria-label="Tour steps">{TOUR.map((c, i) => <button key={c.title} role="tab" aria-selected={step === i + 1} aria-label={c.title} className={step === i + 1 ? "on" : ""} onClick={() => go(i + 1)} />)}</div>
              <button className="wl-pill" onClick={() => go(step + 1)}>{step === 4 ? "Ready" : "Next"}</button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
