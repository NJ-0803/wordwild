"use client";
import dynamic from "next/dynamic";
import { Component, useEffect, useState, type ReactNode } from "react";
import { useProgress } from "@react-three/drei";
import { ThinkingOrb } from "thinking-orbs";
import type { TownSceneProps } from "./TownScene";

const Scene = dynamic(() => import("./TownScene"), { ssr: false, loading: () => <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fff" }}>Building your town…</div> });

class Boundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** Shown while the 3D models download and compile, so the screen is never just empty. */
function Loader() {
  const { active, progress } = useProgress();
  const [gone, setGone] = useState(false);
  useEffect(() => { if (!active && progress >= 100) { const t = setTimeout(() => setGone(true), 500); return () => clearTimeout(t); } }, [active, progress]);
  if (gone) return null;
  return (
    <div role="status" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none", zIndex: 2 }}>
      <div style={{ background: "rgba(8,12,26,.92)", border: "1px solid var(--navy-3)", borderRadius: 20, padding: "18px 26px", textAlign: "center", boxShadow: "0 0 40px rgba(70,110,230,.45)", color: "#fff" }}>
        <ThinkingOrb state="composing" size={64} theme="dark" aria-label="Building your town" />
        <div style={{ fontWeight: 600 }}>Building your town… {Math.round(progress)}%</div>
      </div>
    </div>
  );
}

export function TownSceneLazy(p: TownSceneProps) {
  return <Boundary fallback={<div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fff", padding: 24, textAlign: "center" }}>The 3D town is not available on this device. Your words and coins are safe. Use the buttons below.</div>}><><Loader /><Scene {...p} /></></Boundary>;
}
