"use client";
import { useEffect, useState } from "react";
import { BotAvatar, botAvatarPalette, type BotAvatarType } from "bot-avatars";
import { BorderBeam } from "border-beam";
import { ThinkingOrb } from "thinking-orbs";
import { onSpeaking } from "@/lib/speech";
import { useReducedMotion } from "@/lib/motion";

/** Lumi the companion. Both libraries render a still frame under prefers-reduced-motion; we also pass `paused` for the in-app setting. */
export function Lumi({ mood = "default", size = 72 }: { mood?: "default" | "working" | "sleeping"; size?: number }) {
  const reduced = useReducedMotion();
  return <BotAvatar type="blob" face="mouth" state={mood} size={size} paused={reduced} aria-label="Lumi, your word companion" />;
}

/** Shows while audio is playing so people who cannot read the screen know something is being said. */
export function SpeakingOrb({ size = 64 }: { size?: 20 | 64 }) {
  const [on, setOn] = useState(false);
  const reduced = useReducedMotion();
  useEffect(() => onSpeaking(setOn), []);
  // fixed-height slot: the orb appearing must never shift the buttons under someone's finger
  return <div style={{ height: 64, display: "flex", alignItems: "center" }} aria-live="polite">{on && <ThinkingOrb state="listening" size={size} paused={reduced} aria-label="Reading aloud" />}</div>;
}

export function LookupOrb() { const reduced = useReducedMotion(); return <ThinkingOrb state="searching" size={20} paused={reduced} aria-label="Looking up" />; }

/** Shown while the server prepares a lesson (about 30 seconds): a calm orb, not a frozen button. */
export function ThinkingWait() { const reduced = useReducedMotion(); return <div role="status" aria-label="Preparing practice" style={{ marginTop: 8 }}><ThinkingOrb state="composing" size={64} paused={reduced} /></div>; }

// "blob" is reserved for Lumi, so a word is never mistaken for the companion.
const BUDDIES = (Object.keys(botAvatarPalette) as BotAvatarType[]).filter(t => t !== "blob");
const hash = (t: string) => { let h = 2166136261; for (const c of t) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export type Mastery = "new" | "seen" | "practising" | "secure";

/**
 * Every word gets its own buddy, always the same one (chosen from the word itself), so a word becomes someone you know.
 * Its pose means something: awake and hopping when it is time to review, asleep while a secure word rests until its next review.
 */
export function WordBuddy({ lemma, mastery = "new", due = false, size = 56, mood }: { lemma: string; mastery?: Mastery; due?: boolean; size?: number; mood?: "default" | "working" | "sleeping" }) {
  const reduced = useReducedMotion();
  const type = BUDDIES[hash(lemma) % BUDDIES.length];
  const state = mood ?? (due ? "working" : mastery === "secure" ? "sleeping" : "default");
  return <BotAvatar type={type} face="mouth" state={state} size={size} paused={reduced} aria-label={`${lemma} buddy, ${state === "sleeping" ? "resting" : state === "working" ? "ready to practise" : "awake"}`} />;
}

/** A real reward moment. Reduced motion gets a still, solid ring instead of the moving beam. */
export function Reward({ on, children, colorVariant = "ocean" }: { on: boolean; children: React.ReactNode; colorVariant?: "colorful" | "mono" | "ocean" | "sunset" }) {
  const reduced = useReducedMotion();
  if (!on) return <>{children}</>;
  if (reduced) return <div style={{ borderRadius: 18, outline: "3px solid var(--brand)", outlineOffset: 2 }}>{children}</div>;
  return <BorderBeam size="md" colorVariant={colorVariant} strength={0.85} theme="auto">{children}</BorderBeam>;
}

/** Inline loading indicator: a calm breathing orb plus words, so the screen is never just blank text. */
export function Loading({ text = "Loading…" }: { text?: string }) {
  const reduced = useReducedMotion();
  return <div role="status" className="row" style={{ justifyContent: "flex-start", gap: 10 }}><span style={{ flex: "0 0 auto" }}><ThinkingOrb state="breathing" size={20} paused={reduced} /></span><span className="sub">{text}</span></div>;
}

/** Shown next to the account while progress is being saved. */
export function SyncOrb({ syncing }: { syncing: boolean }) {
  const reduced = useReducedMotion();
  return syncing ? <span role="status" aria-label="Saving to your account" style={{ flex: "0 0 auto", display: "inline-flex" }}><ThinkingOrb state="connecting" size={20} paused={reduced} /></span> : null;
}
