"use client";
import * as THREE from "three";
import { lightAt } from "@/lib/daylight";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { PieceView } from "@core";
import { Label3D, glowTexture } from "../Garden";
import { Model, preload, setNight } from "./Model";

export interface TownSceneProps {
  pieces: PieceView[]; points: number; fresh: string[]; motion: boolean; hour: number; selected: string | null; onPiece: (id: string) => void;
}

const rand = (seed: number) => { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const click = (fn: () => void) => (e: ThreeEvent<MouseEvent>) => { if (e.delta > 6) return; e.stopPropagation(); fn(); };
const pointer = { onPointerOver: () => { document.body.style.cursor = "pointer"; }, onPointerOut: () => { document.body.style.cursor = ""; } };
const T = 2;

/** A soft, mottled grass texture (drawn once), so the ground has life instead of one flat green. */
const grassTexture = (() => {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d")!;
  g.fillStyle = "#6cb44f"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { const x = rand(i) * 256, y = rand(i + 5000) * 256, r = 6 + rand(i + 9000) * 22; g.fillStyle = rand(i + 3) > 0.5 ? "rgba(118,198,84,0.16)" : "rgba(70,140,58,0.13)"; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  for (let i = 0; i < 700; i++) { const x = rand(i + 77) * 256, y = rand(i + 4444) * 256; g.strokeStyle = "rgba(60,128,52,0.35)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 2, y - 5 - rand(i) * 3); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(42, 38); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
})();


/** One built piece of the plan. New ones rise out of the ground; the selected one gets a ring. */
function PieceView3D({ p, fresh, selected, motion, onPiece }: { p: PieceView; fresh: boolean; selected: boolean; motion: boolean; onPiece: (id: string) => void }) {
  const g = useRef<THREE.Group>(null); const ring = useRef<THREE.Mesh>(null); const [start] = useState(fresh && motion); const born = useRef(start ? 0 : 1);
  useFrame((_, dt) => {
    if (g.current && born.current < 1) { born.current = Math.min(1, born.current + dt * 1.1); const t = born.current; const e = 1 - Math.pow(1 - t, 3); const bounce = t < 1 ? 1 + Math.sin(t * Math.PI) * 0.14 : 1; g.current.scale.setScalar(Math.max(0.01, e * bounce)); }
    if (ring.current && motion) ring.current.scale.setScalar(1 + Math.sin(performance.now() / 250) * 0.04);
  });
  const civic = p.kind === "civic" || !!p.civic;
  return (
    <group position={[p.slot[0], 0, p.slot[1]]} rotation={[0, p.rot, 0]}>
      <group ref={g} scale={start ? 0.01 : 1} {...pointer} onClick={click(() => onPiece(p.id))}>
        {p.items.map((it, i) => <Model key={i} path={it.model} unit={it.unit ?? p.unit} position={[it.dx ?? 0, 0, it.dz ?? 0]} rotationY={it.rot ?? 0} />)}
      </group>
      {civic && <group rotation={[0, -p.rot, 0]}><Label3D text={p.name} position={[0, 3.6, 0]} scale={0.55} bg="rgba(12,29,71,0.94)" /></group>}
      {selected && <mesh ref={ring} position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[2.3, 2.5, 48]} /><meshBasicMaterial color="#ffd166" transparent opacity={0.9} /></mesh>}
    </group>
  );
}

/** The next thing that will be built: a little construction site with what it is and how many points it needs. */
function NextSite({ p, points, motion }: { p: PieceView; points: number; motion: boolean }) {
  const cone = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (cone.current && motion) cone.current.position.y = Math.sin(clock.elapsedTime * 2) * 0.05; });
  return (
    <group position={[p.slot[0], 0, p.slot[1]]}>
      <mesh position={[0, 0.03, 0]} receiveShadow><boxGeometry args={[3.6, 0.06, 3.0]} /><meshStandardMaterial color="#a88555" roughness={1} /></mesh>
      <group ref={cone}>
        <Model path="roads/construction-cone" size={0.46} position={[1.3, 0, 1.0]} /><Model path="roads/construction-cone" size={0.46} position={[-1.3, 0, 1.0]} />
        <Model path="nature/log_stack" size={0.85} position={[0.8, 0.06, -0.4]} rotationY={0.6} /><Model path="nature/stone_largeA" size={0.7} position={[-0.8, 0.06, -0.3]} />
      </group>
      <Label3D text={`Next: ${p.name}`} position={[0, 1.7, 0]} scale={0.42} bg="rgba(230,150,20,0.95)" />
      <Label3D text={`${p.at - points} more points`} position={[0, 1.15, 0]} scale={0.32} bg="rgba(20,24,40,0.85)" />
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
    const keepOut = (x: number, z: number) => (Math.abs(x) < 24.5 && z > -15 && z < 22) || Math.abs(z + 16.5) < 3.4 || (z > 21 && x > -26) || (x > 24 && z > 5);   // clear the town, the river, and the view toward the camera
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
  return <><color attach="background" args={[c]} /><fog attach="fog" args={[c, 48, 150]} /></>;
}

function Clouds({ motion }: { motion: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (motion && g.current) { g.current.position.x += dt * 0.25; if (g.current.position.x > 16) g.current.position.x = -16; } });
  return <group ref={g}>{[0, 1, 2, 3].map(i => <sprite key={i} position={[-10 + i * 6, 7 + (i % 2), -6 + i * 1.5]} scale={[5, 2.2, 1]}><spriteMaterial map={glowTexture ?? undefined} color="#ffffff" transparent opacity={0.5} depthWrite={false} /></sprite>)}</group>;
}



// Every model the town can show, requested at once when this code loads.
const PRELOAD = ["city/cottage", "city/house_red", "city/field_wheat", "city/lamp", "city/market_stall", "city/school", "city/tree_round", "city/bakery", "city/fountain",
  "roads/road-straight", "roads/road-crossroad", "roads/road-end", "roads/construction-cone", "nature/log_stack", "nature/stone_largeA", "nature/bridge_woodNarrow",
  "nature/tree_oak", "nature/tree_detailed", "nature/tree_default", "nature/tree_fat", "nature/tree_small", "nature/tree_plateau", "nature/plant_bush", "nature/plant_bushLarge", "nature/plant_bushSmall",
  "nature/flower_redA", "nature/flower_yellowA", "nature/flower_purpleA", "nature/flower_redB", "nature/rock_smallA", "nature/rock_smallC"];
preload(PRELOAD);

function NightGlow({ hour }: { hour: number }) { useEffect(() => { const d = lightAt(hour); setNight(d.intensity < 1.2 ? 1 : d.intensity < 2.2 ? 0.35 : 0); }, [hour]); return null; }

export default function TownScene(p: TownSceneProps) {
  const controls = useRef<{ target: THREE.Vector3 } | null>(null);
  const built = p.pieces.filter(x => x.status === "built"); const next = p.pieces.find(x => x.status === "next") ?? null;
  const fresh = useMemo(() => new Set(p.fresh), [p.fresh]);
  return (
    <Canvas shadows frameloop={p.motion ? "always" : "demand"} dpr={[1, 1.5]} camera={{ position: [32, 31, 46], fov: 30, near: 1, far: 300 }} gl={{ antialias: true }}>
      <Lights hour={p.hour} />
      <Sky hour={p.hour} />
      <NightGlow hour={p.hour} />
      <Suspense fallback={null}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.01, -1]}><planeGeometry args={[400, 360]} /><meshStandardMaterial color="#ffffff" map={grassTexture ?? undefined} roughness={1} /></mesh>
        <River />
        <Roads />
        <Decor />
        {built.map(pc => <PieceView3D key={pc.id} p={pc} fresh={fresh.has(pc.id)} selected={p.selected === pc.id} motion={p.motion} onPiece={p.onPiece} />)}
        {next && <NextSite p={next} points={p.points} motion={p.motion} />}
        <Clouds motion={p.motion} />
      </Suspense>
      <OrbitControls ref={controls as never} enableRotate={false} enablePan enableZoom enableDamping dampingFactor={0.12} minDistance={20} maxDistance={70} target={[0, 0, 5.5]}
        mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }} touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }}
        onChange={() => { const t = controls.current?.target; if (t) { t.x = THREE.MathUtils.clamp(t.x, -16, 16); t.z = THREE.MathUtils.clamp(t.z, -12, 20); } }} />
    </Canvas>
  );
}
