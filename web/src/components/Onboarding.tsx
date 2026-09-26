"use client";
import { Icon } from "./Icons";
import { useEffect } from "react";
import { Btn, Card } from "./ui";
import { Lumi, SpeakingOrb } from "./Companion";
import { useStore } from "@/lib/store";
import { say } from "@/lib/speech";

const HELLO = {
  hi: "वर्डवाइल्ड में आपका स्वागत है। हम यहाँ अंग्रेज़ी के शब्द सुनकर और बोलकर सीखेंगे। आगे बढ़ने के लिए नीचे का बटन दबाइए।",
  en: "Welcome to Wordwild. You will learn English words by listening and doing. Press the button below to start.",
} as const;

export function Onboarding() {
  const { state, update, finishOnboarding } = useStore();
  const lang = state.prefs.explainLang;
  useEffect(() => { /* browsers block autoplay until the first tap, so we do not speak on load */ }, []);
  const pick = (l: "hi" | "en") => { update(s => ({ ...s, prefs: { ...s.prefs, explainLang: l } })); say(HELLO[l], l); };
  return (
    <div className="stack">
      <div className="hero"><Lumi size={84} /><div><h1>Wordwild</h1><p className="sub">अपनी भाषा चुनिए · Choose your language</p></div></div>
      <Btn kind={lang === "hi" ? "primary" : "ghost"} icon={<Icon.Speaker />} onClick={() => pick("hi")} aria-label="Hindi. Plays a welcome message.">हिन्दी</Btn>
      <Btn kind={lang === "en" ? "primary" : "ghost"} icon={<Icon.Speaker />} onClick={() => pick("en")} aria-label="English. Plays a welcome message.">English</Btn>
      <SpeakingOrb />
      <Card><span className="sub small">ਪੰਜਾਬੀ (Punjabi) is not available yet.</span></Card>
      <Btn onClick={finishOnboarding}>{lang === "hi" ? "शुरू करें" : "Start"}</Btn>
      <p className="sub small">No reading test. No timers. You can change everything later in Settings.</p>
    </div>
  );
}
