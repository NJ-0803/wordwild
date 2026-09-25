"use client";
import { useSyncExternalStore } from "react";
import { useStore } from "./store";

const Q = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => { const m = window.matchMedia(Q); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };

/** True when the OS or the learner's own setting asks for reduced motion. */
export function useReducedMotion() {
  const { state } = useStore();
  const os = useSyncExternalStore(subscribe, () => window.matchMedia(Q).matches, () => false);
  return os || state.prefs.reducedMotion;
}
