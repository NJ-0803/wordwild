"use client";
import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";
import type { PlantSpec } from "./Garden";
import { useReducedMotion } from "@/lib/motion";
import { useLive } from "@/lib/inView";

/** People on Data Saver skip the ~240 KB 3D code entirely and get the plain description. */
const saveData = () => typeof navigator !== "undefined" && !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;

const MiniGarden = dynamic(() => import("./Garden").then(m => m.MiniGarden), { ssr: false, loading: () => <div className="sub" style={{ padding: 16 }}>Loading…</div> });
const Garden = dynamic(() => import("./Garden"), { ssr: false, loading: () => <div className="sub" style={{ padding: 16 }}>Loading your garden…</div> });

class Boundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** 3D garden. If WebGL is unavailable the page still works and says so. */
export function GardenScene({ plants, summary }: { plants: PlantSpec[]; summary: string }) {
  const [box, live] = useLive<HTMLDivElement>();
  const motion = !useReducedMotion() && live;               // stops drawing while it is scrolled away or the tab is hidden
  if (saveData()) return <div className="scene" style={{ height: "auto", padding: 16 }}><p style={{ margin: 0 }}>{summary}</p><p className="sub small" style={{ margin: "6px 0 0" }}>The 3D garden is switched off because Data Saver is on.</p></div>;
  return (
    <div ref={box} className="scene" role="img" aria-label={summary} style={{ touchAction: "pan-y" }}>
      {/* The words in the picture are also plain text, so they are available to screen readers. */}
      <ul className="sr">{plants.map(p => <li key={p.id}>{p.label ?? "word"}: {["seed", "sprout", "growing", "in bloom"][p.stage]}</li>)}</ul>
      <Boundary fallback={<p className="sub" style={{ padding: 16 }}>3D view is not available on this device. {summary}</p>}>
        <Garden plants={plants} motion={motion} />
      </Boundary>
    </div>
  );
}

/** A single word's plant. `stage` is its mastery stage; `celebrate` should change on each correct answer. */
export function WordScene({ stage, label, celebrate = 0, summary }: { stage: 0 | 1 | 2 | 3; label?: string; celebrate?: number; summary: string }) {
  const [box, live] = useLive<HTMLDivElement>();
  const motion = !useReducedMotion() && live;
  if (saveData()) return <div className="scene" style={{ height: "auto", padding: 16 }}><p style={{ margin: 0 }}>{summary}</p></div>;
  return (
    <div ref={box} className="scene" role="img" aria-label={summary} style={{ height: 240, touchAction: "pan-y" }}>
      <Boundary fallback={<p className="sub" style={{ padding: 16 }}>3D view is not available on this device. {summary}</p>}>
        <MiniGarden stage={stage} label={label} celebrate={celebrate} motion={motion} />
      </Boundary>
    </div>
  );
}
