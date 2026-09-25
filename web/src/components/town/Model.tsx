"use client";
import * as THREE from "three";
import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";

const BASE = "/town/models";

/** The Kenney nature models ship unlit, metallic and minty. In our lighting they render as dark metal, so we swap them for matte materials in a warm Township palette. */
const PALETTE: Record<string, string> = {
  grass: "#78a856", leafsGreen: "#5a9a44", leafsDark: "#41763a", leafsFall: "#d9822b",
  wood: "#a06e3f", woodDark: "#7c5230", woodBark: "#6e4a2a", woodInner: "#dcc39a", woodBirch: "#ece3cf",
  dirt: "#8a5e36", dirtDark: "#6f4a2a", stone: "#b9b4a8", stoneDark: "#9a9488",
  corn: "#e6c545", colorRed: "#cf4a3f", colorRedDark: "#a83a33", colorYellow: "#eab935", colorPurple: "#8f78d8",
};
const converted = new Map<string, THREE.Material>();
function matte(m: THREE.Material): THREE.Material {
  const src = m as THREE.MeshStandardMaterial;
  if (src.map) return m;                                            // textured city-kit materials are already fine
  const hit = converted.get(m.uuid); if (hit) return hit;
  const color = PALETTE[m.name] ? new THREE.Color(PALETTE[m.name]) : (src.color ? src.color.clone() : new THREE.Color("#ffffff"));
  const out = new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0, side: src.side });
  converted.set(m.uuid, out); return out;
}
export const modelUrl = (path: string) => `${BASE}/${path}.glb`;

/**
 * A CC0 (Kenney) model, cloned per use, scaled so its footprint fits `size` (largest of width/depth), sitting on y = 0 and centred.
 * Shadows are switched on for every mesh so the town feels solid.
 */
export function Model({ path, size, position = [0, 0, 0], rotationY = 0, tint, opacity = 1 }: { path: string; size: number; position?: [number, number, number]; rotationY?: number; tint?: string; opacity?: number }) {
  const { scene } = useGLTF(modelUrl(path));
  const { obj, scale, offset } = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const dim = box.getSize(new THREE.Vector3()); const c = box.getCenter(new THREE.Vector3());
    const s = size / Math.max(dim.x, dim.z, 0.001);
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
    return { obj: clone, scale: s, offset: new THREE.Vector3(-c.x * s, -box.min.y * s, -c.z * s) };
  }, [scene, size, tint, opacity]);
  return <group position={position} rotation={[0, rotationY, 0]}><group position={offset} scale={scale}><primitive object={obj} /></group></group>;
}

export const preload = (paths: string[]) => paths.forEach(p => useGLTF.preload(modelUrl(p)));
