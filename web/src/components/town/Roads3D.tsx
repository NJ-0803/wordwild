"use client";
import * as THREE from "three";
import { useMemo } from "react";
import type { SectorView } from "@core";
import { Instanced, type Spot } from "./Model";

const rand = (seed: number) => { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** Road drawn from a few canvas textures: asphalt with soft grain, and lane markings. */
const tex = (paint: (g: CanvasRenderingContext2D, w: number, h: number) => void, repeatX: number) => {
  const c = document.createElement("canvas"); c.width = 256; c.height = 64; const g = c.getContext("2d")!;
  g.fillStyle = "#565b68"; g.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 420; i++) { g.fillStyle = `rgba(${rand(i) > 0.5 ? "255,255,255" : "0,0,0"},${0.03 + rand(i + 9) * 0.05})`; g.fillRect(rand(i + 1) * 256, rand(i + 2) * 64, 1 + rand(i + 3) * 3, 1 + rand(i + 4) * 2); }
  paint(g, 256, 64);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeatX, 1); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
};
const streetPaint = (g: CanvasRenderingContext2D) => { g.fillStyle = "rgba(255,255,255,0.9)"; for (let i = 0; i < 2; i++) g.fillRect(i * 128 + 12, 29, 60, 5); g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(0, 2, 256, 2); g.fillRect(0, 60, 256, 2); };
const lanePaint = (g: CanvasRenderingContext2D) => { g.fillStyle = "rgba(255,255,255,0.85)"; for (let i = 0; i < 2; i++) g.fillRect(i * 128 + 20, 30, 44, 4); g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect(0, 1, 256, 3); g.fillRect(0, 60, 256, 3); };

type Ax = "h" | "v";
interface Seg { ax: Ax; c: number; a: number; b: number; kind: "street" | "avenue" }
const HALF = { street: 2.3, avenue: 3.8 }, R_ABOUT = 6.2, CUT_ABOUT = 6.4;
const KERB = "#d9d3c6", GRASS = "#5fae47";

/** Roads for every opened sector: streets inside it, wide tree-lined avenues around it, roundabouts where avenues meet. */
export function computeRoads(sectors: SectorView[]) {
  const segs = new Map<string, Seg>();
  const add = (s: Seg) => segs.set(`${s.ax}${s.c}:${s.a}:${s.b}:${s.kind}`, s);
  const about = new Map<string, [number, number]>();
  for (const s of sectors) {
    add({ ax: "h", c: s.oz - 4, a: s.ox - 25, b: s.ox + 25, kind: "street" }); add({ ax: "h", c: s.oz + 4, a: s.ox - 25, b: s.ox + 25, kind: "street" });
    add({ ax: "v", c: s.ox, a: s.oz - 13.5, b: s.oz + 11, kind: "street" });
    if (!s.avenues) continue;
    const top = s.j === 0 ? -13.5 : s.oz - 15.5, bot = s.oz + 26.5;
    for (const sx of [-25, 25]) add({ ax: "v", c: s.ox + sx, a: top, b: bot, kind: "avenue" });
    add({ ax: "h", c: bot, a: s.ox - 25, b: s.ox + 25, kind: "avenue" });
    if (s.j > 0) add({ ax: "h", c: top, a: s.ox - 25, b: s.ox + 25, kind: "avenue" });
    for (const sx of [-25, 25]) { about.set(`${s.ox + sx},${bot}`, [s.ox + sx, bot]); if (s.j > 0) about.set(`${s.ox + sx},${top}`, [s.ox + sx, top]); }
  }
  const list = [...segs.values()];
  const pieces: { ax: Ax; c: number; a: number; b: number; kind: "street" | "avenue" }[] = [];
  const patches: { x: number; z: number; w: number; d: number }[] = [];
  const isAbout = (x: number, z: number) => about.has(`${x},${z}`);
  for (const s of list) {
    const cuts: [number, number][] = [];
    for (const o of list) {
      if (o.ax === s.ax) continue;
      if (!(o.c > s.a && o.c < s.b && s.c > o.a && s.c < o.b)) continue;
      const x = s.ax === "h" ? o.c : s.c, z = s.ax === "h" ? s.c : o.c;
      const half = isAbout(x, z) ? CUT_ABOUT : HALF[o.kind];
      cuts.push([o.c - half, o.c + half]);
      if (s.ax === "h" && !isAbout(x, z) && !patches.some(p => p.x === x && p.z === z)) patches.push({ x, z, w: HALF[o.kind] * 2, d: HALF[s.kind] * 2 });
    }
    cuts.sort((p, q) => p[0] - q[0]);
    let cur = s.a; for (const [lo, hi] of cuts) { if (lo > cur) pieces.push({ ax: s.ax, c: s.c, a: cur, b: lo, kind: s.kind }); cur = Math.max(cur, hi); }
    if (cur < s.b) pieces.push({ ax: s.ax, c: s.c, a: cur, b: s.b, kind: s.kind });
  }
  return { pieces, patches, roundabouts: [...about.values()], segs: list };
}

function Piece({ p, street, lane }: { p: { ax: Ax; c: number; a: number; b: number; kind: "street" | "avenue" }; street: THREE.Texture; lane: THREE.Texture }) {
  const len = p.b - p.a; const cx = (p.a + p.b) / 2;
  const t = useMemo(() => { const x = (p.kind === "street" ? street : lane).clone(); x.needsUpdate = true; x.repeat.set(len / 5.2, 1); return x; }, [p.kind, len, street, lane]);
  const pos: [number, number, number] = p.ax === "h" ? [cx, 0, p.c] : [p.c, 0, cx];
  const rot = p.ax === "h" ? 0 : Math.PI / 2;
  const k = <meshStandardMaterial color={KERB} roughness={0.95} />;
  if (p.kind === "street") return (
    <group position={pos} rotation={[0, rot, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.022, 0]} receiveShadow><planeGeometry args={[len, 3.0]} /><meshStandardMaterial map={t} roughness={0.95} /></mesh>
      {[-1, 1].map(s => <mesh key={s} position={[0, 0.07, s * 1.9]} castShadow receiveShadow><boxGeometry args={[len, 0.14, 0.8]} />{k}</mesh>)}
    </group>
  );
  const laneCentre = 1.75;
  return (
    <group position={pos} rotation={[0, rot, 0]}>
      {[-1, 1].map(s => <mesh key={s} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.022, s * laneCentre]} receiveShadow><planeGeometry args={[len, 2.3]} /><meshStandardMaterial map={t} roughness={0.95} /></mesh>)}
      <mesh position={[0, 0.09, 0]} receiveShadow><boxGeometry args={[len, 0.18, 1.2]} /><meshStandardMaterial color={GRASS} roughness={1} /></mesh>
      <mesh position={[0, 0.1, 0]}><boxGeometry args={[len, 0.14, 1.32]} /><meshStandardMaterial color={KERB} roughness={0.95} /></mesh>
      <mesh position={[0, 0.2, 0]} receiveShadow><boxGeometry args={[len, 0.05, 1.0]} /><meshStandardMaterial color={GRASS} roughness={1} /></mesh>
      {[-1, 1].map(s => <mesh key={`w${s}`} position={[0, 0.07, s * 3.35]} castShadow receiveShadow><boxGeometry args={[len, 0.14, 0.9]} />{k}</mesh>)}
    </group>
  );
}

function Roundabout({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.024, 0]} receiveShadow><circleGeometry args={[R_ABOUT, 48]} /><meshStandardMaterial color="#565b68" roughness={0.95} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}><ringGeometry args={[R_ABOUT - 0.25, R_ABOUT - 0.12, 48]} /><meshStandardMaterial color="#e8e6e0" roughness={0.9} /></mesh>
      <mesh position={[0, 0.09, 0]} receiveShadow castShadow><cylinderGeometry args={[2.9, 3.0, 0.18, 40]} /><meshStandardMaterial color={KERB} roughness={0.95} /></mesh>
      <mesh position={[0, 0.2, 0]} receiveShadow><cylinderGeometry args={[2.65, 2.65, 0.06, 40]} /><meshStandardMaterial color={GRASS} roughness={1} /></mesh>
    </group>
  );
}

export function RoadNet({ sectors }: { sectors: SectorView[] }) {
  const net = useMemo(() => computeRoads(sectors), [sectors]);
  const street = useMemo(() => tex(streetPaint, 1), []), lane = useMemo(() => tex(lanePaint, 1), []);
  const trees = useMemo(() => {
    const med: Spot[] = [], side: Spot[] = [], flow: Spot[] = [], lamps: Spot[] = [];
    for (const s of net.segs) {
      if (s.kind !== "avenue") continue;
      const along = (t: number, off: number): [number, number] => (s.ax === "h" ? [t, s.c + off] : [s.c + off, t]);
      const inCut = (x: number, z: number) => net.roundabouts.some(([rx, rz]) => Math.hypot(rx - x, rz - z) < CUT_ABOUT + 0.8);
      let i = 0;
      for (let t = s.a + 2.2; t < s.b - 1; t += 3.4, i++) { const [x, z] = along(t, 0); if (!inCut(x, z)) med.push({ x, z, s: 0.9 + rand(i + s.c) * 0.25, r: rand(i) * 6.28 }); }
      i = 0;
      for (let t = s.a + 3.5; t < s.b - 1; t += 6.8, i++) for (const o of [-3.35, 3.35]) { const [x, z] = along(t + (o > 0 ? 3.4 : 0), o); if (!inCut(x, z)) (i % 2 ? side : flow).push({ x, z, s: 0.95, r: rand(i + 3) * 6.28 }); }
      i = 0;
      for (let t = s.a + 6; t < s.b - 2; t += 13.6, i++) for (const o of [-2.9, 2.9]) { const [x, z] = along(t, o); if (!inCut(x, z)) lamps.push({ x, z, s: 1 }); }
    }
    return { med, side, flow, lamps };
  }, [net]);
  const island = useMemo(() => net.roundabouts.flatMap(([x, z]) => [{ x, z, s: 1.0, r: 0.4 }]), [net]);
  return (
    <>
      {net.pieces.map((p, i) => <Piece key={`${p.ax}${p.c}${p.a}${p.b}${i}`} p={p} street={street} lane={lane} />)}
      {net.patches.map((p, i) => <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[p.x, 0.026, p.z]} receiveShadow><planeGeometry args={[p.w, p.d]} /><meshStandardMaterial color="#565b68" roughness={0.95} /></mesh>)}
      {net.roundabouts.map(([x, z]) => <Roundabout key={`${x},${z}`} x={x} z={z} />)}
      {trees.med.length > 0 && <Instanced path="city/tree_avenue" items={trees.med} unit={1.5} />}
      {trees.side.length > 0 && <Instanced path="city/tree_flower" items={trees.side} unit={1.5} />}
      {trees.flow.length > 0 && <Instanced path="city/tree_shade" items={trees.flow} unit={1.1} />}
      {trees.lamps.length > 0 && <Instanced path="city/lamp" items={trees.lamps} unit={1.3} />}
      {island.length > 0 && <Instanced path="city/tree_flower" items={island.map(i => ({ ...i, y: 0.2 }))} unit={2.0} />}
    </>
  );
}
