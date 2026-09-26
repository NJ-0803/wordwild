"use client";
import * as THREE from "three";
import { lightAt, useHour } from "@/lib/daylight";
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";

export interface PlantSpec { id: string; stage: 0 | 1 | 2 | 3; label?: string }

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const PETALS = ["#f27fa5", "#f6a85c", "#b48cf2", "#f2d05c", "#6fc7e8", "#ff8f7a"];
const rand = (seed: number) => { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** Leaf and petal outlines drawn with curves, so they read as leaves and petals rather than squashed spheres. */
const shapeGeo = (c1: number, c2: number, w: number) => {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.bezierCurveTo(w, c1, w, c2, 0, 1); s.bezierCurveTo(-w, c2, -w, c1, 0, 0);
  return new THREE.ShapeGeometry(s, 14);
};
const leafGeo = shapeGeo(0.18, 0.72, 0.34);
const petalGeo = shapeGeo(0.15, 0.8, 0.6);
const bladeGeo = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([-0.035, 0, 0, 0.035, 0, 0, 0.0, 0.16, 0.03, 0.02, 0.3, 0.09], 3));
  g.setIndex([0, 1, 2, 1, 3, 2]); g.computeVertexNormals(); return g;
})();

/** Spring (threejs-animation skill): natural overshoot instead of hand-tuned easing. */
class Spring {
  x: number; v = 0; k: number; c: number;
  constructor(x: number, k = 140, c = 9) { this.x = x; this.k = k; this.c = c; }
  step(target: number, dt: number) { const d = Math.min(dt, 1 / 30); this.v += (-this.k * (this.x - target) - this.c * this.v) * d; this.x += this.v * d; return this.x; }
}

/** Grass with wind (threejs-shaders skill: onBeforeCompile on a standard material keeps PBR lighting and shadows). */
function Grass({ plantSpots, motion, radius = 3.15, count = 700 }: { plantSpots: [number, number][]; motion: boolean; radius?: number; count?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const shader = useRef<{ uniforms: { uTime: { value: number } } } | null>(null);
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.85 });
    m.onBeforeCompile = (s) => {
      s.uniforms.uTime = { value: 0 }; shader.current = s as never;
      s.vertexShader = "uniform float uTime;\n" + s.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float phase = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 2.3;
          float bend = sin(uTime * 1.6 + phase) * 0.075 * (position.y / 0.3);   // tips move, roots stay planted
          transformed.x += bend; transformed.z += bend * 0.6;
        #endif`);
    };
    return m;
  }, []);
  useFrame(({ clock }) => { if (motion && shader.current) shader.current.uniforms.uTime.value = clock.elapsedTime; });
  useEffect(() => {
    const m = ref.current; if (!m) return;
    const d = new THREE.Object3D(); const c = new THREE.Color(); let n = 0;
    for (let i = 0; i < count + 200 && n < count; i++) {
      const a = rand(i) * Math.PI * 2, r = Math.sqrt(rand(i + 999)) * radius;
      if (plantSpots.some(([x, z]) => Math.hypot(x - Math.cos(a) * r, z - Math.sin(a) * r) < 0.45)) continue;   // clear lawn around each plant
      d.position.set(Math.cos(a) * r, 0.15, Math.sin(a) * r);
      d.rotation.set(0, rand(i + 5) * 6.28, (rand(i + 9) - 0.5) * 0.4);
      const s = 0.7 + rand(i + 3) * 0.9; d.scale.set(s, s, s); d.updateMatrix();
      m.setMatrixAt(n, d.matrix); m.setColorAt(n, c.setHSL(0.27 + rand(i + 7) * 0.06, 0.55, 0.32 + rand(i + 2) * 0.2)); n++;
    }
    m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [plantSpots, radius, count]);
  return <instancedMesh ref={ref} args={[bladeGeo, material, count]} receiveShadow />;
}

function Island({ r = 3.4 }: { r?: number }) {
  const rock = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(r * 0.76, 2); const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 0.82 + rand(Math.round((x + y * 3 + z * 7) * 50)) * 0.36;
      p.setXYZ(i, x * k * 1.18, Math.min(y * k, 0.2) * (y < 0 ? 1.15 : 0), z * k * 1.18);
    }
    g.computeVertexNormals(); return g;
  }, [r]);
  return (
    <group>
      <mesh receiveShadow><cylinderGeometry args={[r, r * 0.93, 0.3, 64, 1]} /><meshStandardMaterial color="#79bd63" roughness={0.9} /></mesh>
      <mesh geometry={rock} position={[0, -0.05, 0]} scale={[1, 1.3, 1]}><meshStandardMaterial color="#8a6a4e" roughness={1} flatShading /></mesh>
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[r * 0.94, r * 1.005, 64]} /><meshStandardMaterial color="#5e9a4e" roughness={1} /></mesh>
    </group>
  );
}

export const spot = (i: number): [number, number] => { const r = i === 0 ? 0 : 0.95 * Math.sqrt(i) + 0.4; const a = i * GOLDEN; return [Math.cos(a) * r, Math.sin(a) * r]; };

/** One word = one plant. Its stage comes from demonstrated mastery, never from saving alone. */
export function Plant({ p, index, motion, pos, celebrate = 0 }: { p: PlantSpec; index: number; motion: boolean; pos?: [number, number]; celebrate?: number }) {
  const group = useRef<THREE.Group>(null);
  const spring = useRef(new Spring(0.6));
  const prev = useRef(p.stage); const seen = useRef(celebrate);
  const [x, z] = pos ?? spot(index);
  const grow = [0.6, 0.85, 1.1, 1.3][p.stage], h = [0.2, 0.65, 1.05, 1.45][p.stage];
  const petal = PETALS[index % PETALS.length];
  const stem = useMemo(() => {
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.07, h * 0.5, 0.04), new THREE.Vector3(-0.03, h, 0)]);
    return new THREE.TubeGeometry(c, 14, 0.045, 8);
  }, [h]);
  const leaves = useMemo(() => Array.from({ length: [0, 2, 3, 5][p.stage] }, (_, i) => ({ y: h * (0.22 + i * 0.15), a: i * 2.4 + index, s: 0.3 + p.stage * 0.05 + rand(i + index) * 0.08 })), [p.stage, h, index]);

  useFrame(({ clock }, dt) => {
    const g = group.current; if (!g) return;
    if (motion) {
      if (p.stage > prev.current) spring.current.v += 3.2;        // grew: springy pop
      if (celebrate !== seen.current) { spring.current.v += 2.0; seen.current = celebrate; }   // correct answer: small happy bounce
      g.scale.setScalar(spring.current.step(grow, dt));
      g.rotation.z = Math.sin(clock.elapsedTime * 1.1 + index) * 0.03;
    } else { spring.current.x = grow; spring.current.v = 0; g.scale.setScalar(grow); g.rotation.z = 0; seen.current = celebrate; }
    prev.current = p.stage;
  });

  return (
    <group ref={group} position={[x, 0.15, z]} scale={grow}>
      <mesh position={[0, -0.03, 0]} scale={[0.34, 0.1, 0.34]} receiveShadow><sphereGeometry args={[1, 20, 12]} /><meshStandardMaterial color="#6b4a32" roughness={1} /></mesh>
      {p.stage === 0 && <mesh position={[0, 0.07, 0]} scale={[0.09, 0.13, 0.09]} castShadow><sphereGeometry args={[1, 14, 10]} /><meshStandardMaterial color="#c99a4b" roughness={0.5} /></mesh>}
      {p.stage > 0 && <mesh geometry={stem} castShadow><meshStandardMaterial color="#3f9a5a" roughness={0.7} /></mesh>}
      {leaves.map((l, i) => (
        <mesh key={i} geometry={leafGeo} position={[0, l.y, 0]} rotation={[-0.9, l.a, 0]} scale={l.s * 2.1} castShadow>
          <meshStandardMaterial color={i % 2 ? "#4fb06a" : "#2f8a52"} side={THREE.DoubleSide} roughness={0.6} />
        </mesh>
      ))}
      {p.stage === 3 && (
        <group position={[-0.03, h + 0.02, 0]}>
          {Array.from({ length: 8 }, (_, i) => (
            <mesh key={i} geometry={petalGeo} rotation={[-1.2, (i / 8) * Math.PI * 2, 0]} scale={0.46} castShadow>
              <meshStandardMaterial color={petal} side={THREE.DoubleSide} roughness={0.45} />
            </mesh>
          ))}
          <mesh position={[0, 0.03, 0]}><sphereGeometry args={[0.08, 16, 12]} /><meshStandardMaterial color="#f7d24a" roughness={0.35} emissive="#f7b500" emissiveIntensity={0.3} /></mesh>
        </group>
      )}
      {p.label && <Label3D text={p.label} position={[0, -0.12, 0.42]} />}
    </group>
  );
}

/** A word label drawn inside the scene as a sprite. (drei's Html mounts a separate React root, which can throw while the scene unmounts.) */
export function Label3D({ text, position, bg = "rgba(8,12,26,0.85)", fg = "#fff", scale = 0.26 }: { text: string; position: [number, number, number]; bg?: string; fg?: string; scale?: number }) {
  const { map, aspect } = useMemo(() => {
    const c = document.createElement("canvas"); const g = c.getContext("2d")!; const font = "600 30px system-ui, sans-serif";
    g.font = font; const w = Math.max(96, Math.ceil(g.measureText(text).width) + 36); c.width = w; c.height = 56;
    g.font = font; g.fillStyle = bg; g.beginPath(); g.roundRect(0, 0, w, 56, 28); g.fill();
    g.fillStyle = fg; g.textBaseline = "middle"; g.textAlign = "center"; g.fillText(text, w / 2, 30);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { map: t, aspect: w / 56 };
  }, [text, bg, fg]);
  useEffect(() => () => map.dispose(), [map]);
  return <sprite position={position} scale={[scale * aspect, scale, 1]} renderOrder={10}><spriteMaterial map={map} transparent depthTest={false} toneMapped={false} /></sprite>;
}

/** Soft glow drawn as a sprite instead of a full-screen bloom pass: same look, no extra render pass on cheap phones. */
export const glowTexture = (() => {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d")!; const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,244,170,1)"); grad.addColorStop(0.35, "rgba(255,230,120,.45)"); grad.addColorStop(1, "rgba(255,220,100,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();

function Fireflies({ motion, spread = 6 }: { motion: boolean; spread?: number }) {
  const ref = useRef<THREE.Points>(null); const mat = useRef<THREE.PointsMaterial>(null);
  const pos = useMemo(() => { const a = new Float32Array(24 * 3); for (let i = 0; i < 24; i++) { a[i * 3] = (rand(i) - 0.5) * spread; a[i * 3 + 1] = 0.6 + rand(i + 50) * 1.8; a[i * 3 + 2] = (rand(i + 90) - 0.5) * spread; } return a; }, [spread]);
  useFrame(({ clock }) => {
    if (!motion || !ref.current || !mat.current) return;
    ref.current.position.y = Math.sin(clock.elapsedTime * 0.6) * 0.12; ref.current.rotation.y = clock.elapsedTime * 0.04;
    mat.current.opacity = 0.75 + Math.sin(clock.elapsedTime * 2.2) * 0.2;
  });
  return <points ref={ref}><bufferGeometry><bufferAttribute attach="attributes-position" args={[pos, 3]} /></bufferGeometry>
    <pointsMaterial ref={mat} map={glowTexture ?? undefined} color="#fff2a8" size={0.34} transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation /></points>;
}

/** Desktop only: the camera drifts a little with the pointer. Off for reduced motion, and never captures touch scrolling. */
function Parallax({ motion, y = 3.9, look = 0.15 }: { motion: boolean; y?: number; look?: number }) {
  useFrame(({ camera, pointer }) => {
    if (!motion) return;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, pointer.x * 0.9, 0.04);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, y + pointer.y * 0.35, 0.04);
    camera.lookAt(0, look, 0);
  });
  return null;
}

/** Narrow screens get a wider view so the whole island fits instead of being cropped at the sides. */
function FitWidth({ wide = 1.45 }: { wide?: number }) {
  const { camera, size } = useThree();
  // Mutating the three.js camera is the normal react-three-fiber way; it is not React state.
  // eslint-disable-next-line react-hooks/immutability
  useEffect(() => { const c = camera as THREE.PerspectiveCamera; c.zoom = Math.min(1, size.width / size.height / wide); c.updateProjectionMatrix(); }, [camera, size.width, size.height, wide]);
  return null;
}

/** Outdoor daylight (threejs-lighting skill): warm sun with tight soft shadows, cool fill, sky/ground hemisphere. */
function Lights({ extent = 4.5 }: { extent?: number }) {
  const hour = useHour(); const L = lightAt(hour);                       // follows the real clock: bright by day, dim at night
  return (
    <>
      <hemisphereLight args={[L.sky, L.ground, L.hemi * 1.15]} />
      <directionalLight position={[L.pos[0] * 0.5, L.pos[1] * 0.6, 3]} intensity={L.intensity * 0.78} color={L.color} castShadow shadow-mapSize={[512, 512]}
        shadow-camera-left={-extent} shadow-camera-right={extent} shadow-camera-top={extent} shadow-camera-bottom={-extent}
        shadow-camera-near={1} shadow-camera-far={20} shadow-bias={-0.0004} shadow-normalBias={0.03} />
      <directionalLight position={[-5, 2, -4]} intensity={0.12 + 0.33 * Math.max(0, Math.sin(Math.PI * (hour - 6) / 12))} color="#9fd4ff" />
    </>
  );
}

export default function Garden({ plants, motion }: { plants: PlantSpec[]; motion: boolean }) {
  const shown = plants.slice(0, 14);
  const spots = useMemo(() => shown.map((_, i) => spot(i)), [shown.length]);   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Canvas shadows frameloop={motion ? "always" : "demand"} dpr={[1, 1.5]} camera={{ position: [0, 4.3, 7.4], fov: 40 }}
      onCreated={({ camera }) => camera.lookAt(0, 0.1, 0)}>
      <FitWidth />
      <Lights />
      <Island />
      <Grass plantSpots={spots} motion={motion} />
      {shown.map((p, i) => <Plant key={p.id} p={p} index={i} motion={motion} />)}
      <Fireflies motion={motion} />
      <Parallax motion={motion} y={4.3} look={0.1} />
      <ContactShadows position={[0, 0.16, 0]} opacity={0.35} scale={8} blur={2.4} far={2} frames={1} resolution={256} />
    </Canvas>
  );
}

/** One word's own plant on a small island: used on the lesson and practice screens. `celebrate` bumps on each correct answer. */
export function MiniGarden({ stage, label, celebrate, motion, index = 0 }: { stage: 0 | 1 | 2 | 3; label?: string; celebrate: number; motion: boolean; index?: number }) {
  return (
    <Canvas shadows frameloop={motion ? "always" : "demand"} dpr={[1, 1.5]} camera={{ position: [0, 2.3, 5.0], fov: 40 }}
      onCreated={({ camera }) => camera.lookAt(0, 0.85, 0)}>
      <Lights extent={2.5} />
      <Island r={1.7} />
      <Grass plantSpots={[[0, 0]]} motion={motion} radius={1.6} count={260} />
      <Plant p={{ id: "w", stage, label }} index={index} motion={motion} pos={[0, 0]} celebrate={celebrate} />
      <Fireflies motion={motion} spread={3.4} />
      <Parallax motion={motion} y={2.3} look={0.85} />
    </Canvas>
  );
}
