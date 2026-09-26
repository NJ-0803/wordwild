"use client";
import { useState } from "react";
import { motion } from "motion/react";
import { Icon } from "./Icons";
import { Lumi } from "./Companion";
import { TiltCard } from "./TiltCard";
import { useStore } from "@/lib/store";
import { useReducedMotion } from "@/lib/motion";
import { say } from "@/lib/speech";

const HELLO = {
  hi: "वर्डवाइल्ड में आपका स्वागत है। हम यहाँ अंग्रेज़ी के शब्द सुनकर और बोलकर सीखेंगे। आगे बढ़ने के लिए नीचे का बटन दबाइए।",
  en: "Welcome to Wordwild. You will learn English words by listening and doing. Press the button below to start.",
} as const;
const EASE = [0.23, 1, 0.32, 1] as const;

/** Language choice: two glass boxes floating in the air, leaning toward the pointer. Picking one lifts it; Start carries you into Today. */
export function Onboarding() {
  const { state, update, finishOnboarding } = useStore();
  const reduced = useReducedMotion();
  const lang = state.prefs.explainLang;
  const [picked, setPicked] = useState(false); const [leaving, setLeaving] = useState(false);
  const pick = (l: "hi" | "en") => { update(s => ({ ...s, prefs: { ...s.prefs, explainLang: l } })); setPicked(true); say(HELLO[l], l); };
  const go = () => { setLeaving(true); setTimeout(finishOnboarding, reduced ? 0 : 420); };
  const opts = [{ id: "en" as const, big: "English", sub: "Meanings in English" }, { id: "hi" as const, big: "हिन्दी", sub: "अर्थ हिन्दी में" }];
  return (
    <motion.div className="ob" initial={reduced ? false : { opacity: 0, y: 24, filter: "blur(10px)" }} animate={leaving ? { opacity: 0, y: -18, scale: 1.04, filter: "blur(14px)" } : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }} transition={{ duration: 0.55, ease: EASE }}>
      <div className="ob-head"><Lumi size={72} /><h1>{lang === "hi" && picked ? "अपनी भाषा चुनिए" : "Choose your language"}</h1><p className="sub">अपनी भाषा चुनिए · You can change it any time in Settings.</p></div>
      <div className="ob-air">
        {opts.map((o, i) => (
          <motion.div key={o.id} className="ob-float" animate={reduced ? undefined : { y: [0, -10, 0] }} transition={{ duration: 5.2 + i * 0.7, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}>
            <TiltCard max={9} className="ob-tilt">
              <button className={`wl-glass ob-box${lang === o.id && picked ? " on" : ""}${picked && lang !== o.id ? " dim" : ""}`} onClick={() => pick(o.id)} aria-pressed={lang === o.id && picked} aria-label={`${o.big}. Plays a welcome message.`}>
                <span className="ob-ic"><Icon.Speaker /></span><b lang={o.id}>{o.big}</b><small lang={o.id}>{o.sub}</small>
              </button>
            </TiltCard>
            <span className="ob-shadow" aria-hidden />
          </motion.div>))}
      </div>
      <motion.div initial={false} animate={picked ? { opacity: 1, y: 0 } : { opacity: 0.0, y: 14 }} transition={{ duration: 0.4, ease: EASE }} style={{ pointerEvents: picked ? "auto" : "none" }}>
        <button className="ob-go" onClick={go} tabIndex={picked ? 0 : -1}>{lang === "hi" ? "शुरू करें" : "Start"}</button>
      </motion.div>
      <p className="sub small" style={{ textAlign: "center" }}>No reading test. No timers.</p>
    </motion.div>
  );
}
