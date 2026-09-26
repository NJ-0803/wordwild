"use client";
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useStore } from "@/lib/store";
import { Btn, Card } from "@/components/ui";
import { ThinkingOrb } from "thinking-orbs";
import { Orb } from "@/components/Companion";
import { ProfileCard } from "@/components/ProfileCard";
import { TelegramCard } from "@/components/TelegramCard";
import { WhatsAppCard } from "@/components/WhatsAppCard";
import { PrivacyCard } from "@/components/PrivacyCard";
import { ExtensionCallout } from "@/components/ExtensionCallout";

export default function Settings() {
  const { state, update, ready, skipDay, devOffsetDays, sync, deleteAccountData } = useStore();
  const { isSignedIn } = useAuth();
  const [editProfile, setEditProfile] = useState(false);
  const [confirm, setConfirm] = useState(false); const [msg, setMsg] = useState("");
  if (!ready) return null;
  const p = state.prefs; const set = (patch: Partial<typeof p>) => update(s => ({ ...s, prefs: { ...s.prefs, ...patch } }));
  return (
    <div className="stack settings-cols">
      <Orb size={96} label="Wordwild" />
      <h1>Settings</h1>
      <h2>Text size</h2>
      {([[1, "Normal"], [1.25, "Large"], [1.5, "Extra large"]] as const).map(([v, l]) => <Btn key={v} kind={p.textScale === v ? "primary" : "ghost"} aria-pressed={p.textScale === v} onClick={() => set({ textScale: v })}>{l}</Btn>)}
      <h2>Read aloud</h2>
      <Btn kind={p.audioFirst ? "primary" : "ghost"} aria-pressed={p.audioFirst} onClick={() => set({ audioFirst: !p.audioFirst })}>{p.audioFirst ? "Reading questions aloud: on" : "Reading questions aloud: off"}</Btn>
      <h2>Motion</h2>
      <Btn kind={p.reducedMotion ? "primary" : "ghost"} aria-pressed={p.reducedMotion} onClick={() => set({ reducedMotion: !p.reducedMotion })}>{p.reducedMotion ? "Reduced motion: on" : "Reduced motion: off"}</Btn>
      <h2>Meanings in</h2>
      <Btn kind={p.explainLang === "hi" ? "primary" : "ghost"} aria-pressed={p.explainLang === "hi"} onClick={() => set({ explainLang: "hi" })}>हिन्दी</Btn>
      <Btn kind={p.explainLang === "en" ? "primary" : "ghost"} aria-pressed={p.explainLang === "en"} onClick={() => set({ explainLang: "en" })}>English only</Btn>
      <h2>About you</h2>
      {editProfile ? <ProfileCard onDone={() => setEditProfile(false)} /> : (
        <Card>
          <p className="sub small">{p.profile ? "We use this only to choose words that fit you. Age and schooling never limit what you can learn." : "Optional. Tell us a little so we can choose words that fit you."}</p>
          <Btn kind="soft" onClick={() => setEditProfile(true)}>{p.profile ? "Change my answers" : "Answer a few questions"}</Btn>
          {p.profile && <Btn kind="ghost" onClick={() => set({ profile: undefined })}>Forget my answers</Btn>}
        </Card>)}
      <WhatsAppCard />
      <TelegramCard />
      <ExtensionCallout />
      <PrivacyCard />
      <h2>Your account</h2>
      {!isSignedIn ? <Card><span className="sub small">Your words and notes stay on this device. Sign in to keep them safe and use them on other devices.</span></Card> : (
        <Card>
          <p role="status" className="row" style={{ justifyContent: "flex-start", gap: 10 }}>{sync === "syncing" && <span style={{ flex: "0 0 auto" }}><ThinkingOrb state="weaving" size={20} /></span>}<b>{{ syncing: "Saving to your account…", synced: "Saved to your account", offline: "Offline. Changes will save when you are back online.", error: "Could not save right now. We will try again.", off: "Sync is not set up on this server." }[sync]}</b></p>
          <p className="sub small">Your private notes are stored only under your account, and only you can read them. You can delete everything at any time.</p>
          {!confirm ? <Btn kind="ghost" onClick={() => { setConfirm(true); setMsg(""); }}>Delete all my data</Btn> : (
            <div className="stack">
              <p><b>This removes your words, progress and notes from your account and this device. It cannot be undone.</b></p>
              <div className="row">
                <Btn kind="ghost" onClick={() => setConfirm(false)}>Keep my data</Btn>
                <Btn onClick={async () => { const ok = await deleteAccountData(); setConfirm(false); setMsg(ok ? "All your data was deleted." : "Could not delete right now. Please try again."); }}>Yes, delete</Btn>
              </div>
            </div>)}
          {msg && <p role="status">{msg}</p>}
        </Card>)}
      {process.env.NODE_ENV !== "production" && <Card tone="warn"><b>Developer</b><p className="small">Move time forward to test spaced review. Now +{devOffsetDays} day(s).</p><Btn kind="soft" onClick={skipDay}>Skip one day</Btn></Card>}
    </div>
  );
}
