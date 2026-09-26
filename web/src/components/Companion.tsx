"use client";
import { useEffect, useState } from "react";
import { BotAvatar, botAvatarPalette, type BotAvatarType } from "bot-avatars";
import { BorderBeam } from "border-beam";
import { ThinkingOrb } from "thinking-orbs";
import { onSpeaking } from "@/lib/speech";
import { useReducedMotion } from "@/lib/motion";
import { useLive } from "@/lib/inView";

/** Lumi the companion. Both libraries render a still frame under prefers-reduced-motion; we also pass `paused` for the in-app setting. */
export function Lumi({ mood = "default", size = 72 }: { mood?: "default" | "working" | "sleeping"; size?: number }) {
  const reduced = useReducedMotion();
  return <BotAvatar type="blob" face="mouth" state={mood} size={size} paused={reduced} aria-label="Lumi, your word companion" />;
}

/** Shows while audio is playing so people who cannot read the screen know something is being said. */
export function SpeakingOrb({ size = 88 }: { size?: number }) {
  const [on, setOn] = useState(false);
  const reduced = useReducedMotion(); const [box, live] = useLive<HTMLDivElement>();
  useEffect(() => onSpeaking(setOn), []);
  // always visible: it glows and listens while audio plays, and rests otherwise. Fixed slot so nothing shifts under a finger.
  return <div ref={box} style={{ height: size, display: "flex", alignItems: "center", justifyContent: "center" }} aria-live="polite"><BigOrb state={on ? "listening" : "weaving"} size={size} paused={reduced || !live} label={on ? "Reading aloud" : "Ready"} /></div>;
}

/** The library only renders 64/32/20, so a bigger orb is the 64 one scaled up (crisp: it is vector and shader-drawn). */
function BigOrb({ state, size, paused, label }: { state: "weaving" | "listening" | "searching" | "solving" | "composing"; size: number; paused: boolean; label: string }) {
  return <div style={{ width: size, height: size, position: "relative" }}><div style={{ width: 64, height: 64, transform: `scale(${size / 64})`, transformOrigin: "top left" }}><ThinkingOrb state={state} size={64} paused={paused} aria-label={label} /></div></div>;
}

/** A large orb, the visual centre of a screen. It rests (stops drawing) while it is off screen, the tab is hidden, or `still` is set. The glow behind it is a still gradient: a filter on an animating canvas would repaint every frame. */
export function Orb({ state = "weaving", size = 120, label, still = false }: { state?: "weaving" | "listening" | "searching" | "solving" | "composing"; size?: number; label?: string; still?: boolean }) {
  const reduced = useReducedMotion(); const [box, live] = useLive<HTMLDivElement>();
  return (
    <div ref={box} style={{ position: "relative", display: "grid", placeItems: "center" }}>
      <span aria-hidden style={{ position: "absolute", left: "50%", top: "50%", width: size * 1.44, height: size * 1.44, translate: "-50% -50%", borderRadius: "50%", background: "radial-gradient(circle, rgba(80,120,255,.42), rgba(80,120,255,0) 68%)", pointerEvents: "none" }} />
      <div style={{ position: "relative" }}><BigOrb state={state} size={size} paused={reduced || still || !live} label={label ?? "Wordwild is ready"} /></div>
    </div>
  );
}

/**
 * The border beam on every card, button and field. A light travels round the edge, drawn as a rotating gradient behind an opaque child:
 * only `rotate` animates, which the browser runs on the compositor thread (no repaint, no layout), and it pauses while off screen.
 * The heavier library beam is kept for reward moments only (see Reward). Reduced motion gets a still glowing edge.
 */
export function Beam({ children, radius = 20, style }: { children: React.ReactNode; radius?: number; variant?: "colorful" | "mono" | "ocean" | "sunset"; style?: React.CSSProperties }) {
  const [ref, live] = useLive<HTMLDivElement>();
  return <div ref={ref} className="cbeam" data-live={live ? "1" : "0"} style={{ ["--r" as string]: `${radius}px`, borderRadius: radius, ...style }}>{children}</div>;
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
  if (reduced) return <div style={{ borderRadius: 18, outline: "3px solid var(--navy-glow)", outlineOffset: 2 }}>{children}</div>;
  return <BorderBeam size="md" colorVariant={colorVariant} strength={1} brightness={1.4} theme="dark">{children}</BorderBeam>;
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
