"use client";
import * as THREE from "three";
import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Pick, Role } from "@core";
import { Label3D, glowTexture } from "./Garden";

export const ROLE_COLOR: Record<Role, string> = {
  "same-meaning": "#4fb0ff", stronger: "#ff6b6b", gentler: "#7ee0a1", opposite: "#c58bff", "used-together": "#ffc857",
  "same-family": "#ff9f5a", "same-situation": "#5ee6d0", "easier-bridge": "#f4a6d7",
};

const rand = (seed: number) => { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function Stars({ motion }: { motion: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const pos = useMemo(() => { const a = new Float32Array(160 * 3); for (let i = 0; i < 160; i++) { const r = 6 + rand(i) * 4, t = rand(i + 9) * 6.28, u = rand(i + 99) * 3.14; a[i * 3] = r * Math.sin(u) * Math.cos(t); a[i * 3 + 1] = r * Math.cos(u) * 0.6; a[i * 3 + 2] = r * Math.sin(u) * Math.sin(t); } return a; }, []);
  useFrame(({ clock }) => { if (motion && ref.current) ref.current.rotation.y = clock.elapsedTime * 0.01; });
  return <points ref={ref}><bufferGeometry><bufferAttribute attach="attributes-position" args={[pos, 3]} /></bufferGeometry>
    <pointsMaterial map={glowTexture ?? undefined} color="#cfe3ff" size={0.22} transparent opacity={0.7} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation /></points>;
}

function Planet({ p, i, n, learnerLevel, motion, selected, onSelect }: { p: Pick; i: number; n: number; learnerLevel: number; motion: boolean; selected: boolean; onSelect: (id: string) => void }) {
  const g = useRef<THREE.Group>(null); const mesh = useRef<THREE.Mesh>(null);
  // distance from the star = how far the word is from the reader's level: closer = easier, farther = a bigger stretch
  const radius = 1.5 + Math.min(2.5, Math.abs(p.level - learnerLevel)) * 0.45 + (i % 2) * 0.25;
  const a0 = (i / n) * Math.PI * 2 + 0.4; const speed = 0.22 / radius; const y = ((i % 3) - 1) * 0.25;
  useFrame(({ clock }) => {
    const a = a0 + (motion ? clock.elapsedTime * speed : 0);
    if (g.current) g.current.position.set(Math.cos(a) * radius, y, Math.sin(a) * radius);
    if (mesh.current) { const s = selected ? 1.35 : 1; mesh.current.scale.setScalar(THREE.MathUtils.lerp(mesh.current.scale.x, s, 0.12)); }
  });
  const color = ROLE_COLOR[p.role];
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}><ringGeometry args={[radius - 0.008, radius + 0.008, 96]} /><meshBasicMaterial color={color} transparent opacity={selected ? 0.55 : 0.18} side={THREE.DoubleSide} /></mesh>
      <group ref={g}>
        <mesh ref={mesh} onClick={e => { e.stopPropagation(); onSelect(p.senseId); }} onPointerOver={() => { document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = ""; }}>
          <sphereGeometry args={[0.2, 28, 20]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 0.9 : 0.35} roughness={0.35} metalness={0.1} />
        </mesh>
        <Label3D text={p.lemma} position={[0, -0.42, 0]} />
      </group>
    </>
  );
}

function Star({ lemma, motion }: { lemma: string; motion: boolean }) {
  const halo = useRef<THREE.Sprite>(null);
  useFrame(({ clock }) => { if (motion && halo.current) halo.current.scale.setScalar(2.4 + Math.sin(clock.elapsedTime * 1.4) * 0.15); });
  return (
    <group>
      <mesh><sphereGeometry args={[0.5, 40, 28]} /><meshStandardMaterial color="#ffd166" emissive="#ffb703" emissiveIntensity={1.1} roughness={0.4} /></mesh>
      <sprite ref={halo} scale={[2.4, 2.4, 1]}><spriteMaterial map={glowTexture ?? undefined} color="#ffd98a" transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
      <Label3D text={lemma} position={[0, 0.95, 0]} />
    </group>
  );
}

/** A word and the words that travel with it. Orbit distance = how far each word is from the reader's level. */
export default function Constellation3D({ target, picks, learnerLevel, motion, selected, onSelect }: { target: string; picks: Pick[]; learnerLevel: number; motion: boolean; selected: string | null; onSelect: (id: string) => void }) {
  return (
    <Canvas frameloop={motion ? "always" : "demand"} dpr={[1, 2]} camera={{ position: [0, 3.4, 5.8], fov: 42 }} onCreated={({ camera }) => camera.lookAt(0, 0, 0)}>
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 0, 0]} intensity={30} color="#ffd98a" distance={12} decay={2} />
      <directionalLight position={[3, 5, 4]} intensity={0.6} />
      <Stars motion={motion} />
      <Star lemma={target} motion={motion} />
      {picks.map((p, i) => <Planet key={p.senseId} p={p} i={i} n={picks.length} learnerLevel={learnerLevel} motion={motion} selected={selected === p.senseId} onSelect={onSelect} />)}
    </Canvas>
  );
}
