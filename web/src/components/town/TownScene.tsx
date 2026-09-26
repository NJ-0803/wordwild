"use client";
import * as THREE from "three";
import { lightAt } from "@/lib/daylight";
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

// The town is laid out on a tile grid (1 tile = 2 world units): a north road and a south road joined by a middle road, buildings on lots along them,
// and two fenced fields south of the south road where the words grow.
const T = 2;
const FIELD_COLS = 6, FIELD_ROWS = 2, PER_FIELD = FIELD_COLS * FIELD_ROWS, MAX_PLOTS = PER_FIELD * 2;
const FIELD_Z = [9.2, 11.4];
const plotPos = (i: number): [number, number, number] => {
  const f = i < PER_FIELD ? 0 : 1, k = i % PER_FIELD, col = k % FIELD_COLS, row = Math.floor(k / FIELD_COLS);
  return [(f === 0 ? -11 : 3.2) + col * 1.6, 0, FIELD_Z[row]];
};

const markerTexture = (() => {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 6, 64, 64, 62); grad.addColorStop(0, "rgba(214,226,255,1)"); grad.addColorStop(0.6, "rgba(86,126,255,0.95)"); grad.addColorStop(1, "rgba(255,180,40,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128); g.fillStyle = "#04050a"; g.font = "800 64px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("!", 64, 68);
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
      {p.ripe && <><Ripe y={1.5} motion={motion} seed={i} />{lemma && <Label3D text={lemma} position={[0, -0.05, 0.75]} scale={0.3} bg="rgba(12,29,71,0.96)" />}</>}
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
  const rail = (x: number, z: number, r: number, size: number) => <Model key={`${x}${z}`} path="nature/fence_planks" size={size} position={[x, 0, z]} rotationY={r} />;
  return (
    <group>
      <mesh position={[0, 0.03, 0]} receiveShadow><boxGeometry args={[3.6, 0.06, 3.2]} /><meshStandardMaterial color={dim ? "#7d7566" : "#9b7a4a"} roughness={1} /></mesh>
      {rail(-0.9, -1.55, 0, 1.8)}{rail(0.9, -1.55, 0, 1.8)}{rail(-0.9, 1.55, 0, 1.8)}{rail(0.9, 1.55, 0, 1.8)}{rail(-1.75, -0.8, Math.PI / 2, 1.6)}{rail(-1.75, 0.8, Math.PI / 2, 1.6)}{rail(1.75, -0.8, Math.PI / 2, 1.6)}{rail(1.75, 0.8, Math.PI / 2, 1.6)}
      <Model path="roads/construction-cone" size={0.42} position={[1.2, 0, 1.05]} />
      <Model path="roads/construction-cone" size={0.42} position={[-1.2, 0, 1.05]} />
      <Model path="nature/log_stack" size={0.8} position={[0.7, 0.06, -0.4]} rotationY={0.6} tint={dim ? "#9a9488" : undefined} />
      <Model path="nature/stone_largeA" size={0.7} position={[-0.7, 0.06, -0.3]} />
      {b.status === "ready" && <Ripe y={1.9} motion seed={b.unlockLevel} />}
      <Label3D text={b.name} position={[0, 1.6, 0]} scale={0.42} bg={dim ? "rgba(70,80,90,0.9)" : "rgba(12,29,71,0.96)"} />
      <Label3D text={b.status === "locked" ? `Level ${b.unlockLevel}` : b.status === "ready" ? "Tap to build" : `${b.needCoins} more coins`} position={[0, 1.12, 0]} scale={0.32} bg={b.status === "ready" ? "rgba(230,150,20,0.95)" : "rgba(20,24,26,0.8)"} />
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
        <Label3D text={b.name} position={[0, 3.0, 0]} scale={0.42} bg="rgba(12,29,71,0.96)" />
        {(b.id === "home" || b.id === "cafe") && <Smoke position={[0.5, 1.7, 0]} motion={motion} />}
      </> : <Site b={b} />}
      {selected && <mesh ref={ring} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.5, 1.68, 48]} /><meshBasicMaterial color="#ffd166" transparent opacity={0.9} /></mesh>}
    </group>
  );
}

/** Streets: two horizontal roads and a middle road, with crossroads where they meet. */
function Roads() {
  const at = (tx: number, tz: number): [number, number, number] => [tx * T, 0.02, tz * T];
  const pieces: { path: string; tx: number; tz: number; r: number }[] = [];
  for (const tz of [-2, 2]) for (let tx = -6; tx <= 6; tx++) pieces.push({ path: tx === 0 ? "roads/road-crossroad" : "roads/road-straight", tx, tz, r: 0 });
  for (let tz = -7; tz <= 5; tz++) { if (tz === -2 || tz === 2) continue; pieces.push({ path: tz === 5 ? "roads/road-end" : "roads/road-straight", tx: 0, tz, r: tz === 5 ? Math.PI : Math.PI / 2 }); }
  return <>{pieces.map((p, i) => <Model key={i} path={p.path} size={T} position={at(p.tx, p.tz)} rotationY={p.r} />)}</>;
}

/** Street lamps along both sides of the two main roads. */
function Lamps() {
  const out: { x: number; z: number; r: number }[] = [];
  for (const tz of [-2, 2]) for (const tx of [-5, -2, 2, 5]) out.push({ x: tx * T + 1, z: tz * T + (tz < 0 ? -1.15 : 1.15), r: tz < 0 ? 0 : Math.PI });
  return <>{out.map((l, i) => <Model key={i} path="roads/light-square" size={0.95} position={[l.x, 0, l.z]} rotationY={l.r} />)}</>;
}

/** Background houses and gardens: the town beyond the chapter buildings, so the streets look lived in. */
function Houses() {
  const homes: [string, number, number, number][] = [
    ["suburban/building-type-a", -16.5, -8, Math.PI / 2], ["suburban/building-type-b", -16.5, -1, Math.PI / 2], ["suburban/building-type-c", -16.5, 6, Math.PI / 2],
    ["suburban/building-type-e", 16.5, -8, -Math.PI / 2], ["suburban/building-type-g", 16.5, -1, -Math.PI / 2], ["suburban/building-type-j", 16.5, 6, -Math.PI / 2],
    ["suburban/building-type-c", -7.5, -13, 0], ["suburban/building-type-a", 7, -13, 0],
  ];
  return <>{homes.map(([path, x, z, r], i) => <group key={i}><Model path={path} size={3.0} position={[x, 0, z]} rotationY={r} /><Model path="nature/plant_bushLarge" size={0.9} position={[x + (x < 0 ? 1.9 : -1.9), 0, z + 1.4]} /></group>)}</>;
}

/** A river across the top of the map with a wooden bridge where the middle road meets it. */
function River() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, -16.5]} receiveShadow><planeGeometry args={[110, 5.6]} /><meshStandardMaterial color="#d9caa0" roughness={1} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, -16.5]}><planeGeometry args={[110, 4]} /><meshStandardMaterial color="#3f8fd0" roughness={0.25} metalness={0.05} emissive="#123a66" emissiveIntensity={0.25} /></mesh>
      <Model path="nature/bridge_woodNarrow" size={5.4} position={[0, 0.06, -16.5]} rotationY={Math.PI / 2} />
    </>
  );
}

/** Trees and bushes: dense on the edges, cleared where the town and fields are. */
function Decor() {
  const items = useMemo(() => {
    const out: { path: string; size: number; x: number; z: number; r: number }[] = [];
    const trees = ["nature/tree_oak", "nature/tree_detailed", "nature/tree_default", "nature/tree_fat", "nature/tree_small", "nature/tree_plateau", "nature/tree_tall", "nature/tree_pineRoundA", "nature/tree_pineTallA"];
    const keepOut = (x: number, z: number) => (Math.abs(x) < 19.5 && z > -15 && z < 15.5) || Math.abs(z + 16.5) < 3.4 || (z > 15 && x > -22) || (x > 19 && z > 5);   // clear the town, the river, and the view toward the camera
    let n = 0;
    for (let i = 0; i < 2600 && n < 130; i++) {
      const x = (rand(i) - 0.5) * 66, z = (rand(i + 500) - 0.5) * 60 - 2; if (keepOut(x, z)) continue;
      out.push({ path: trees[i % trees.length], size: 1.5 + rand(i + 9) * 1.3, x, z, r: rand(i + 3) * 6.28 }); n++;
    }
    for (let i = 0; i < 40; i++) {                                                                // hedges and bushes along the town edge
      const x = (rand(i + 70) - 0.5) * 34, z = rand(i + 11) > 0.5 ? -14.2 : 14.2; out.push({ path: ["nature/plant_bush", "nature/plant_bushLarge", "nature/plant_bushSmall"][i % 3], size: 0.9, x, z, r: rand(i) * 6 });
    }
    for (let i = 0; i < 70; i++) {                                                                // flowers and stones between the streets
      const x = (rand(i + 900) - 0.5) * 30, z = (rand(i + 1300) - 0.5) * 24 - 1; if (Math.abs(z + 4) < 2.2 || Math.abs(z - 4) < 2.2 || Math.abs(x) < 1.8 || z > 6 || Math.abs(z + 8) < 3 && Math.abs(x) < 12) continue;
      out.push({ path: ["nature/flower_redA", "nature/flower_yellowA", "nature/flower_purpleA", "nature/flower_redB", "nature/stone_smallA"][i % 5], size: 0.45, x, z, r: rand(i) * 6 });
    }
    return out;
  }, []);
  return <>{items.map((it, i) => <Model key={i} path={it.path} size={it.size} position={[it.x, 0, it.z]} rotationY={it.r} />)}</>;
}

/** Two fenced fields: tilled soil and a rail fence, with a gap at the road. */
function Fields() {
  const rails: React.ReactNode[] = [];
  for (const [x0, x1] of [[-12.2, -0.9], [0.9, 12.2]] as const) {
    const z0 = 7.6, z1 = 12.9;
    for (let x = x0 + 0.9; x <= x1 - 0.9; x += 1.8) { rails.push(<Model key={`a${x}${x0}`} path="nature/fence_planks" size={1.8} position={[x, 0, z1]} />); if (x < x1 - 3.6 || x0 > 0) rails.push(<Model key={`b${x}${x0}`} path="nature/fence_planks" size={1.8} position={[x, 0, z0]} />); }
    for (let z = z0 + 0.9; z <= z1 - 0.9; z += 1.8) { rails.push(<Model key={`c${z}${x0}`} path="nature/fence_planks" size={1.8} position={[x0, 0, z]} rotationY={Math.PI / 2} />, <Model key={`d${z}${x0}`} path="nature/fence_planks" size={1.8} position={[x1, 0, z]} rotationY={Math.PI / 2} />); }
  }
  return (
    <>
      {[[-6.5, 10.2], [6.5, 10.2]].map(([x, z], i) => <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.025, z]} receiveShadow><planeGeometry args={[10.6, 5.2]} /><meshStandardMaterial color="#6a4a2a" roughness={1} /></mesh>)}
      {rails}
    </>
  );
}

function Lights({ hour }: { hour: number }) {
  const L = useMemo(() => lightAt(hour), [hour]);
  return (
    <>
      <hemisphereLight args={[L.sky, L.ground, L.hemi]} />
      <directionalLight position={L.pos} intensity={L.intensity} color={L.color} castShadow shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-26} shadow-camera-right={26} shadow-camera-top={26} shadow-camera-bottom={-26} shadow-camera-near={1} shadow-camera-far={90} shadow-bias={-0.0004} shadow-normalBias={0.04} />
    </>
  );
}

/** Horizon: the sky colour and a soft distance fog follow the time of day, so the edge of the map fades into the air instead of ending. */
function Sky({ hour }: { hour: number }) {
  const c = useMemo(() => lightAt(hour).sky.clone().lerp(new THREE.Color("#ffffff"), 0.18), [hour]);
  return <><color attach="background" args={[c]} /><fog attach="fog" args={[c, 70, 190]} /></>;
}

function Clouds({ motion }: { motion: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (motion && g.current) { g.current.position.x += dt * 0.25; if (g.current.position.x > 16) g.current.position.x = -16; } });
  return <group ref={g}>{[0, 1, 2, 3].map(i => <sprite key={i} position={[-10 + i * 6, 7 + (i % 2), -6 + i * 1.5]} scale={[5, 2.2, 1]}><spriteMaterial map={glowTexture ?? undefined} color="#ffffff" transparent opacity={0.5} depthWrite={false} /></sprite>)}</group>;
}

// Every model the town can show. Requested all at once, the moment this code loads, instead of one after another as each component renders.
const PRELOAD = [
  "suburban/building-type-d", "suburban/building-type-h", "suburban/building-type-o", "commercial/building-c", "commercial/building-f", "commercial/building-i", "commercial/building-k", "commercial/building-m",
  "nature/crops_dirtSingle", "nature/crops_wheatStageA", "nature/crops_wheatStageB", ...MATURE, "nature/log_stack", "nature/rock_smallA", "nature/path_stone", "nature/rock_smallC",
  "nature/tree_oak", "nature/tree_detailed", "nature/tree_default", "nature/tree_fat", "nature/tree_small", "nature/tree_plateau",
  "nature/plant_bush", "nature/plant_bushDetailed", "nature/plant_bushSmall", "nature/flower_redA", "nature/flower_yellowA", "nature/flower_purpleA", "nature/flower_redB",
];
preload([...PRELOAD, "roads/road-straight", "roads/road-crossroad", "roads/road-end", "roads/light-square", "roads/construction-fence", "roads/construction-cone", "roads/construction-barrier", "nature/fence_planks", "nature/ground_riverStraight", "nature/bridge_woodNarrow", "nature/tree_tall", "nature/tree_pineRoundA", "nature/tree_pineTallA", "nature/plant_bushLarge", "nature/stone_largeA", "nature/stone_smallA", "suburban/building-type-a", "suburban/building-type-b", "suburban/building-type-c", "suburban/building-type-e", "suburban/building-type-g", "suburban/building-type-j"]);

export default function TownScene(p: TownSceneProps) {
  const controls = useRef<{ target: THREE.Vector3 } | null>(null);
  const shown = p.plots.slice(0, MAX_PLOTS);
  return (
    <Canvas shadows frameloop={p.motion ? "always" : "demand"} dpr={[1, 1.5]} camera={{ position: [27, 27, 37], fov: 30, near: 1, far: 300 }} gl={{ antialias: true }}>
      <Lights hour={p.hour} />
      <Sky hour={p.hour} />
      <Suspense fallback={null}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.01, -1]}><planeGeometry args={[400, 360]} /><meshStandardMaterial color="#6c9f50" roughness={1} /></mesh>
        <River />
        <Roads />
        <Lamps />
        <Houses />
        <Fields />
        <Decor />
        {p.buildings.map(b => <BuildingView key={b.id} b={b} selected={p.selectedBuilding === b.id} motion={p.motion} onBuilding={p.onBuilding} />)}
        {shown.map((pl, i) => <PlotView key={pl.senseId} p={pl} i={i} lemma={p.lemmas[pl.senseId]} motion={p.motion} onPlot={p.onPlot} />)}
        {Array.from({ length: MAX_PLOTS - shown.length }, (_, k) => <Model key={`bed${k}`} path="nature/crops_dirtSingle" size={1.15} position={plotPos(shown.length + k)} />)}   {/* empty tilled beds: room for the next words */}
        <Clouds motion={p.motion} />
      </Suspense>
      <OrbitControls ref={controls as never} enableRotate={false} enablePan enableZoom enableDamping dampingFactor={0.12} minDistance={18} maxDistance={64} target={[0, 0, 2]}
        mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }} touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }}
        onChange={() => { const t = controls.current?.target; if (t) { t.x = THREE.MathUtils.clamp(t.x, -14, 14); t.z = THREE.MathUtils.clamp(t.z, -12, 14); } }} />
    </Canvas>
  );
}
