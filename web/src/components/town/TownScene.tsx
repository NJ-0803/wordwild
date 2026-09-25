"use client";
import * as THREE from "three";
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { Plot, TownView } from "@core";
import { Label3D, glowTexture } from "../Garden";
import { Model, preload } from "./Model";

export interface TownSceneProps {
  buildings: TownView["buildings"]; plots: Plot[]; lemmas: Record<string, string>; motion: boolean; hour: number;
  selectedBuilding: string | null; onBuilding: (id: string) => void; onPlot: (senseId: string) => void;
}

const rand = (seed: number) => { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const hash = (t: string) => { let h = 2166136261; for (const c of t) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const click = (fn: () => void) => (e: ThreeEvent<MouseEvent>) => { if (e.delta > 6) return; e.stopPropagation(); fn(); };
const pointer = { onPointerOver: () => { document.body.style.cursor = "pointer"; }, onPointerOut: () => { document.body.style.cursor = ""; } };

const MATURE = ["nature/crop_pumpkin", "nature/crop_melon", "nature/crops_cornStageD", "nature/crop_carrot", "nature/crop_turnip"];
const cropFor = (p: Plot): { path: string; size: number } | null =>
  p.stage === 0 ? null : p.stage === 1 ? { path: "nature/crops_wheatStageA", size: 0.95 } : p.stage === 2 ? { path: "nature/crops_wheatStageB", size: 1.0 }
  : { path: MATURE[hash(p.senseId) % MATURE.length], size: MATURE[hash(p.senseId) % MATURE.length].includes("corn") ? 1.0 : 0.8 };

const FARM_COLS = 8, FARM_ROWS = 3, MAX_PLOTS = FARM_COLS * FARM_ROWS;
const plotPos = (i: number): [number, number, number] => [-4.9 + (i % FARM_COLS) * 1.4, 0, 2.6 + Math.floor(i / FARM_COLS) * 1.3];

const markerTexture = (() => {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 6, 64, 64, 62); grad.addColorStop(0, "rgba(255,240,160,1)"); grad.addColorStop(0.6, "rgba(255,200,60,0.95)"); grad.addColorStop(1, "rgba(255,180,40,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128); g.fillStyle = "#5a3a00"; g.font = "800 64px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("!", 64, 68);
  return new THREE.CanvasTexture(c);
})();

/** Bobbing golden "!" over a word that is ready to harvest. */
function Ripe({ y, motion, seed }: { y: number; motion: boolean; seed: number }) {
  const ref = useRef<THREE.Sprite>(null);
  useFrame(({ clock }) => { if (ref.current) ref.current.position.y = y + (motion ? Math.sin(clock.elapsedTime * 2.4 + seed) * 0.09 : 0); });
  return <sprite ref={ref} position={[0, y, 0]} scale={[0.62, 0.62, 1]} renderOrder={5}><spriteMaterial map={markerTexture ?? undefined} transparent depthTest={false} /></sprite>;
}

function PlotView({ p, i, lemma, motion, onPlot }: { p: Plot; i: number; lemma?: string; motion: boolean; onPlot: (id: string) => void }) {
  const crop = cropFor(p); const pos = plotPos(i);
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (g.current && p.ripe && motion) g.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 3 + i) * 0.035); });
  return (
    <group position={pos} {...pointer} onClick={click(() => onPlot(p.senseId))}>
      <Model path="nature/crops_dirtSingle" size={1.15} />
      <group ref={g}>{crop && <Model path={crop.path} size={crop.size} position={[0, 0.08, 0]} rotationY={(hash(p.senseId) % 6) * 0.5} />}</group>
      {p.stage === 0 && <mesh position={[0, 0.1, 0]} scale={[0.3, 0.14, 0.3]}><sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color="#8a5a2b" roughness={1} /></mesh>}
      {p.ripe && <><Ripe y={1.5} motion={motion} seed={i} />{lemma && <Label3D text={lemma} position={[0, -0.05, 0.75]} scale={0.22} bg="rgba(40,90,50,0.9)" />}</>}
    </group>
  );
}

function Smoke({ position, motion }: { position: [number, number, number]; motion: boolean }) {
  const refs = useRef<(THREE.Sprite | null)[]>([]);
  useFrame(({ clock }) => refs.current.forEach((s, i) => {
    if (!s) return; const t = motion ? ((clock.elapsedTime * 0.35 + i / 5) % 1) : i / 5;
    s.position.set(Math.sin(t * 6 + i) * 0.08, t * 1.1, 0); s.scale.setScalar(0.25 + t * 0.55); (s.material as THREE.SpriteMaterial).opacity = 0.5 * (1 - t);
  }));
  return <group position={position}>{[0, 1, 2, 3, 4].map(i => <sprite key={i} ref={el => { refs.current[i] = el; }}><spriteMaterial map={glowTexture ?? undefined} color="#f4f4f4" transparent depthWrite={false} opacity={0.4} /></sprite>)}</group>;
}

function Site({ b }: { b: TownView["buildings"][number] }) {
  const dim = b.status === "locked";
  const post = (x: number, z: number) => <mesh key={`${x}${z}`} position={[x, 0.32, z]} castShadow><boxGeometry args={[0.1, 0.56, 0.1]} /><meshStandardMaterial color={dim ? "#8b8378" : "#8a5a30"} roughness={0.9} /></mesh>;
  return (
    <group>
      <mesh position={[0, 0.04, 0]} receiveShadow><boxGeometry args={[2.4, 0.08, 2.1]} /><meshStandardMaterial color={dim ? "#c2bcae" : "#dcc38c"} roughness={1} /></mesh>
      <mesh position={[0, 0.09, 0]} receiveShadow><boxGeometry args={[2.1, 0.03, 1.8]} /><meshStandardMaterial color={dim ? "#b3ad9f" : "#cdb27a"} roughness={1} /></mesh>
      {post(-1.1, -0.95)}{post(1.1, -0.95)}{post(-1.1, 0.95)}{post(1.1, 0.95)}
      <Model path="nature/log_stack" size={0.75} position={[0.55, 0.08, 0.3]} rotationY={0.6} tint={dim ? "#9a9488" : undefined} />
      <Model path="nature/rock_smallA" size={0.5} position={[-0.6, 0.08, -0.3]} />
      {b.status === "ready" && <Ripe y={1.6} motion seed={b.unlockLevel} />}
      <Label3D text={b.name} position={[0, 1.15, 0]} scale={0.26} bg={dim ? "rgba(70,80,90,0.9)" : "rgba(30,110,80,0.95)"} />
      <Label3D text={b.status === "locked" ? `Level ${b.unlockLevel}` : b.status === "ready" ? "Tap to build!" : `${b.needCoins} more coins`} position={[0, 0.78, 0]} scale={0.2} bg={b.status === "ready" ? "rgba(230,150,20,0.95)" : "rgba(20,24,26,0.8)"} />
    </group>
  );
}

function BuildingView({ b, selected, motion, onBuilding }: { b: TownView["buildings"][number]; selected: boolean; motion: boolean; onBuilding: (id: string) => void }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => { if (ring.current) ring.current.scale.setScalar(1 + (motion ? Math.sin(clock.elapsedTime * 4) * 0.05 : 0)); });
  const built = b.status === "built";
  return (
    <group position={[b.slot[0], 0, b.slot[1]]} {...pointer} onClick={click(() => onBuilding(b.id))}>
      {built ? <>
        <Model path={b.model} size={2.6} />
        <Label3D text={b.name} position={[0, 2.7, 0]} scale={0.26} bg="rgba(30,110,80,0.95)" />
        {(b.id === "home" || b.id === "cafe") && <Smoke position={[0.5, 1.7, 0]} motion={motion} />}
      </> : <Site b={b} />}
      {selected && <mesh ref={ring} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.5, 1.68, 48]} /><meshBasicMaterial color="#ffd166" transparent opacity={0.9} /></mesh>}
    </group>
  );
}

function Decor() {
  const items = useMemo(() => {
    const out: { path: string; size: number; x: number; z: number; r: number }[] = [];
    const trees = ["nature/tree_oak", "nature/tree_detailed", "nature/tree_default", "nature/tree_fat", "nature/tree_small", "nature/tree_plateau"];
    const keepOut = (x: number, z: number) => Math.abs(x) < 8.4 && z > -6.4 && z < 7.4;
    let nt = 0, nb = 0;
    for (let i = 0; i < 400 && (nt < 26 || nb < 14); i++) {
      const x = (rand(i) - 0.5) * 30, z = (rand(i + 500) - 0.5) * 24 - 1; if (keepOut(x, z)) continue;
      if (nt < 26) { out.push({ path: trees[i % trees.length], size: 1.2 + rand(i + 9) * 0.9, x, z, r: rand(i + 3) * 6.28 }); nt++; }
      else if (nb < 14) { out.push({ path: ["nature/plant_bush", "nature/plant_bushDetailed", "nature/plant_bushSmall"][i % 3], size: 0.8, x, z, r: rand(i) * 6 }); nb++; }
    }
    for (let i = 0; i < 40; i++) {                                                               // flowers and rocks between buildings and farm
      const x = (rand(i + 900) - 0.5) * 14, z = 1.3 - rand(i + 1300) * 1.6 + (i % 2) * 5.6; if (Math.abs(z + 3.6) < 1.7 || Math.abs(z + 0.8) < 1.7 || z > 2.0 && z < 6.2) continue;
      out.push({ path: ["nature/flower_redA", "nature/flower_yellowA", "nature/flower_purpleA", "nature/flower_redB", "nature/rock_smallC"][i % 5], size: 0.42, x, z, r: rand(i) * 6 });
    }
    return out;
  }, []);
  return <>{items.map((it, i) => <Model key={i} path={it.path} size={it.size} position={[it.x, 0, it.z]} rotationY={it.r} />)}</>;
}

function Paths() {
  const tiles: [number, number][] = [];
  for (let x = -6.6; x <= 6.6; x += 1.1) tiles.push([x, 1.2]);
  for (let z = 0.2; z >= -2.0; z -= 1.1) tiles.push([0, z]);
  return <>{tiles.map(([x, z], i) => <Model key={i} path="nature/path_stone" size={1.15} position={[x, 0.01, z]} rotationY={i % 2 ? 0 : Math.PI / 2} />)}</>;
}

function Lights({ hour }: { hour: number }) {
  const { color, intensity, hemi } = useMemo(() => {
    if (hour >= 17 && hour < 20) return { color: "#ffb26b", intensity: 1.9, hemi: 0.9 };            // golden evening
    if (hour >= 20 || hour < 5) return { color: "#8fa8ff", intensity: 1.1, hemi: 0.75 };              // night stays readable
    if (hour < 8) return { color: "#ffd9a8", intensity: 1.8, hemi: 0.95 };
    return { color: "#fff4d8", intensity: 2.3, hemi: 1.0 };
  }, [hour]);
  return (
    <>
      <hemisphereLight args={["#e8f4ff", "#7fa060", hemi]} />
      <directionalLight position={[8, 12, 6]} intensity={intensity} color={color} castShadow shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={14} shadow-camera-bottom={-14} shadow-camera-near={1} shadow-camera-far={40} shadow-bias={-0.0004} shadow-normalBias={0.04} />
    </>
  );
}

function Clouds({ motion }: { motion: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (motion && g.current) { g.current.position.x += dt * 0.25; if (g.current.position.x > 16) g.current.position.x = -16; } });
  return <group ref={g}>{[0, 1, 2, 3].map(i => <sprite key={i} position={[-10 + i * 6, 7 + (i % 2), -6 + i * 1.5]} scale={[5, 2.2, 1]}><spriteMaterial map={glowTexture ?? undefined} color="#ffffff" transparent opacity={0.55} depthWrite={false} /></sprite>)}</group>;
}

// Every model the town can show. Requested all at once, the moment this code loads, instead of one after another as each component renders.
const PRELOAD = [
  "suburban/building-type-d", "suburban/building-type-h", "suburban/building-type-o", "commercial/building-c", "commercial/building-f", "commercial/building-i", "commercial/building-k", "commercial/building-m",
  "nature/crops_dirtSingle", "nature/crops_wheatStageA", "nature/crops_wheatStageB", ...MATURE, "nature/log_stack", "nature/rock_smallA", "nature/path_stone", "nature/rock_smallC",
  "nature/tree_oak", "nature/tree_detailed", "nature/tree_default", "nature/tree_fat", "nature/tree_small", "nature/tree_plateau",
  "nature/plant_bush", "nature/plant_bushDetailed", "nature/plant_bushSmall", "nature/flower_redA", "nature/flower_yellowA", "nature/flower_purpleA", "nature/flower_redB",
];
preload(PRELOAD);

export default function TownScene(p: TownSceneProps) {
  const controls = useRef<{ target: THREE.Vector3 } | null>(null);
  const shown = p.plots.slice(0, MAX_PLOTS);
  return (
    <Canvas shadows frameloop={p.motion ? "always" : "demand"} dpr={[1, 1.5]} camera={{ position: [12, 14, 15.5], fov: 36, near: 0.5, far: 90 }} gl={{ antialias: true }}>
      <Lights hour={p.hour} />
      <Suspense fallback={null}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.01, -0.5]}><planeGeometry args={[60, 50]} /><meshStandardMaterial color="#86cf68" roughness={1} /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 4.15]}><planeGeometry args={[13.2, 4.7]} /><meshStandardMaterial color="#7cbf5f" roughness={1} /></mesh>
        <Paths />
        <Decor />
        {p.buildings.map(b => <BuildingView key={b.id} b={b} selected={p.selectedBuilding === b.id} motion={p.motion} onBuilding={p.onBuilding} />)}
        {shown.map((pl, i) => <PlotView key={pl.senseId} p={pl} i={i} lemma={p.lemmas[pl.senseId]} motion={p.motion} onPlot={p.onPlot} />)}
        <Clouds motion={p.motion} />
      </Suspense>
      <OrbitControls ref={controls as never} enableRotate={false} enablePan enableZoom enableDamping dampingFactor={0.12} minDistance={10} maxDistance={30} target={[0, 0, 0.6]}
        mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }} touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }}
        onChange={() => { const t = controls.current?.target; if (t) { t.x = THREE.MathUtils.clamp(t.x, -7, 7); t.z = THREE.MathUtils.clamp(t.z, -6, 7); } }} />
    </Canvas>
  );
}
