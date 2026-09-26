"use client";
import * as THREE from "three";
import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { useLayoutEffect, useRef } from "react";

const BASE = "/town/models";

/** The Kenney nature models ship unlit, metallic and minty. In our lighting they render as dark metal, so we swap them for matte materials in a warm Township palette. */
const PALETTE: Record<string, string> = {
  grass: "#78a856", leafsGreen: "#5a9a44", leafsDark: "#41763a", leafsFall: "#d9822b",
  wood: "#a06e3f", woodDark: "#7c5230", woodBark: "#6e4a2a", woodInner: "#dcc39a", woodBirch: "#ece3cf",
  dirt: "#8a5e36", dirtDark: "#6f4a2a", stone: "#b9b4a8", stoneDark: "#9a9488",
  corn: "#e6c545", colorRed: "#cf4a3f", colorRedDark: "#a83a33", colorYellow: "#eab935", colorPurple: "#8f78d8",
};
const converted = new Map<string, THREE.Material>();
/** Windows glow warm after dark. One shared set, so the whole town lights up together when the hour changes. */
const glass = new Set<THREE.MeshStandardMaterial>(); let night = 0;
export function setNight(v: number) { night = v; glass.forEach(g => { g.emissiveIntensity = 0.04 + v * 1.6; }); }
export function matte(m: THREE.Material): THREE.Material {
  const src = m as THREE.MeshStandardMaterial;
  if (src.map) return m;                                            // textured city-kit materials are already fine
  const hit = converted.get(m.uuid); if (hit) return hit;
  if (m.name === "glasspane" || m.name === "PANE") {
    const g = new THREE.MeshStandardMaterial({ color: new THREE.Color("#bfe6f5"), roughness: 0.1, metalness: 0.05, transparent: true, opacity: 0.38, depthWrite: false });
    converted.set(m.uuid, g); return g;
  }
  if (m.name === "glass") {
    const g = new THREE.MeshStandardMaterial({ color: new THREE.Color("#8fd0f2"), roughness: 0.18, metalness: 0.05, emissive: new THREE.Color("#ffc766"), emissiveIntensity: 0.04 + night * 1.6 });
    glass.add(g); converted.set(m.uuid, g); return g;
  }
  const color = PALETTE[m.name] ? new THREE.Color(PALETTE[m.name]) : (src.color ? src.color.clone() : new THREE.Color("#ffffff"));
  const out = new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0, side: src.side });
  converted.set(m.uuid, out); return out;
}
export const modelUrl = (path: string) => `${BASE}/${path}.glb`;

/**
 * A CC0 (Kenney) model, cloned per use, scaled so its footprint fits `size` (largest of width/depth), sitting on y = 0 and centred.
 * Shadows are switched on for every mesh so the town feels solid.
 */
export function Model({ path, size = 1, unit, position = [0, 0, 0], rotationY = 0, tint, opacity = 1 }: { path: string; size?: number; unit?: number; position?: [number, number, number]; rotationY?: number; tint?: string; opacity?: number }) {
  const { scene } = useGLTF(modelUrl(path));
  const { obj, scale, offset } = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const dim = box.getSize(new THREE.Vector3()); const c = box.getCenter(new THREE.Vector3());
    const s = unit ?? size / Math.max(dim.x, dim.z, 0.001);
    clone.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true; m.receiveShadow = true;
        m.material = Array.isArray(m.material) ? m.material.map(matte) : matte(m.material);
        if (tint || opacity < 1) {
          const mat = (m.material as THREE.MeshStandardMaterial).clone();
          if (tint) mat.color.lerp(new THREE.Color(tint), 0.55);
          if (opacity < 1) { mat.transparent = true; mat.opacity = opacity; }
          m.material = mat;
        }
      }
    });
    return { obj: clone, scale: s, offset: unit ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(-c.x * s, -box.min.y * s, -c.z * s) };   // Blender-made city models are already centred on their base
  }, [scene, size, unit, tint, opacity]);
  return <group position={position} rotation={[0, rotationY, 0]}><group position={offset} scale={scale}><primitive object={obj} /></group></group>;
}

export const preload = (paths: string[]) => paths.forEach(p => useGLTF.preload(modelUrl(p)));

export interface Spot { x: number; z: number; s?: number; r?: number; y?: number }
/** Many copies of one model drawn in a single call per part (avenue trees, lamps, hedges), so a big city stays light. */
export function Instanced({ path, items, unit = 1, fit }: { path: string; items: Spot[]; unit?: number; fit?: number }) {
  const { scene } = useGLTF(modelUrl(path));
  const base = useMemo(() => { if (!fit) return unit; const b = new THREE.Box3().setFromObject(scene), d = b.getSize(new THREE.Vector3()); return fit / Math.max(d.x, d.z, 0.001); }, [scene, fit, unit]);
  const parts = useMemo(() => {
    const out: { geo: THREE.BufferGeometry; mat: THREE.Material; m: THREE.Matrix4 }[] = []; scene.updateMatrixWorld(true);
    scene.traverse(o => { const me = o as THREE.Mesh; if (me.isMesh) out.push({ geo: me.geometry, mat: Array.isArray(me.material) ? matte(me.material[0]) : matte(me.material), m: me.matrixWorld.clone() }); });
    return out;
  }, [scene]);
  return <>{parts.map((p, i) => <InstancedPart key={i} part={p} items={items} unit={base} />)}</>;
}
function InstancedPart({ part, items, unit }: { part: { geo: THREE.BufferGeometry; mat: THREE.Material; m: THREE.Matrix4 }; items: Spot[]; unit: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const im = ref.current; if (!im) return;
    const t = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    items.forEach((it, i) => { q.setFromAxisAngle(up, it.r ?? 0); const s = unit * (it.s ?? 1); sc.set(s, s, s); pos.set(it.x, it.y ?? 0, it.z); t.compose(pos, q, sc).multiply(part.m); im.setMatrixAt(i, t); });
    im.count = items.length; im.instanceMatrix.needsUpdate = true;
  }, [items, part, unit]);
  return <instancedMesh key={items.length} ref={ref} args={[part.geo, part.mat, Math.max(1, items.length)]} castShadow receiveShadow frustumCulled={false} />;
}
