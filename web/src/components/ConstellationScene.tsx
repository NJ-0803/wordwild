"use client";
import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";
import type { Pick } from "@core";
import { useReducedMotion } from "@/lib/motion";

const Scene = dynamic(() => import("./Constellation3D"), { ssr: false, loading: () => <div className="sub" style={{ padding: 16 }}>Opening the sky…</div> });
const saveData = () => typeof navigator !== "undefined" && !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;

class Boundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function ConstellationScene({ target, picks, learnerLevel, selected, onSelect }: { target: string; picks: Pick[]; learnerLevel: number; selected: string | null; onSelect: (id: string) => void }) {
  const motion = !useReducedMotion();
  const summary = `${target} with ${picks.length} related words around it: ${picks.map(p => p.lemma).join(", ")}.`;
  if (saveData()) return null;
  return (
    <div className="scene sky" role="group" aria-label={summary} style={{ height: 340, touchAction: "pan-y" }}>
      <Boundary fallback={null}><Scene target={target} picks={picks} learnerLevel={learnerLevel} motion={motion} selected={selected} onSelect={onSelect} /></Boundary>
    </div>
  );
}
