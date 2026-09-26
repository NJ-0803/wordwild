import * as THREE from "three";
import { useEffect, useState } from "react";

/** Light follows the real clock, smoothly: fresh and bright in the morning, full at noon, golden toward evening, dim and cool at night. `hour` may have decimals. */
const mix = (a: string, b: string, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), Math.min(1, Math.max(0, t)));
export function lightAt(hour: number) {
  const d = Math.pow(Math.max(0, Math.sin(Math.PI * (hour - 6) / 12)), 0.6);   // 0 at 06:00 and 18:00, 1 at noon; rises quickly so mornings feel fresh
  const low = 1 - d;                                                       // sun close to the horizon
  const sunColor = d < 0.06 ? mix("#8fa8ff", "#ffd9a8", d / 0.06) : mix("#fff4e0", "#ffb878", (low - 0.25) / 0.75);
  const a = Math.PI * (hour - 6) / 12;
  return {
    color: sunColor, intensity: 0.5 + 2.9 * d, hemi: 0.5 + 0.55 * d,
    sky: mix("#33427a", "#cfe6ff", d * 1.4), ground: mix("#0e1626", "#6f9a55", d * 1.4),
    pos: [d > 0.02 ? -11 * Math.cos(a) : 4, 3 + 8 * Math.max(d, 0.2), 6] as [number, number, number],
  };
}

/** Real time of day as a decimal hour, refreshed every minute. `?hour=7.5` overrides it, only to check how a time of day looks. */
export function useHour(): number {
  const read = () => {
    const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("hour") : null;
    if (q !== null && Number.isFinite(Number(q))) return Math.min(24, Math.max(0, Number(q)));
    const t = new Date(); return t.getHours() + t.getMinutes() / 60;
  };
  const [h, setH] = useState(read);
  useEffect(() => { const i = setInterval(() => setH(read()), 60_000); return () => clearInterval(i); }, []);
  return h;
}
