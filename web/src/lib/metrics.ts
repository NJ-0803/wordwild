"use client";
import type { Metric } from "@core";

/**
 * Anonymous counts, off by switch, by Do Not Track and by Global Privacy Control. What is and is not sent is fixed in core/metrics.ts.
 * The device id is random, lives only in this browser, and can be reset from Settings.
 */
const DID = "ww.did", OFF = "ww.metrics", LAST = "ww.lastOpen";
const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* private mode */ } };

export function metricsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (nav.doNotTrack === "1" || nav.globalPrivacyControl === true) return false;
  return get(OFF) !== "off";
}
export function setMetricsEnabled(on: boolean) { set(OFF, on ? null : "off"); if (!on) set(DID, null); }
export function resetDeviceId() { set(DID, null); set(LAST, null); }
export const respectsSignal = () => typeof navigator !== "undefined" && ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true || navigator.doNotTrack === "1");

function deviceId(): string {
  let d = get(DID);
  if (!d || !/^[a-z0-9]{16,40}$/.test(d)) { const a = new Uint8Array(12); crypto.getRandomValues(a); d = [...a].map(b => b.toString(36).padStart(2, "0")).join("").slice(0, 24); set(DID, d); }
  return d;
}

let queue: Metric[] = []; let timer: ReturnType<typeof setTimeout> | null = null;
function flush() {
  timer = null; if (!queue.length || !metricsEnabled()) { queue = []; return; }
  const body = JSON.stringify({ device: deviceId(), events: queue.slice(0, 12) }); queue = queue.slice(12);
  try { if (!navigator.sendBeacon?.("/api/metrics", new Blob([body], { type: "application/json" }))) void fetch("/api/metrics", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }); } catch { /* never disturb the page */ }
  if (queue.length) timer = setTimeout(flush, 500);
}
export function track(name: Metric["name"], label?: string) {
  if (!metricsEnabled()) return;
  queue.push(label ? { name, label } : { name }); if (!timer) timer = setTimeout(flush, 1500);
}
/** At most once per calendar day per device. */
export function trackOpenOncePerDay() {
  const day = String(Math.floor(Date.now() / 86_400_000)); if (get(LAST) === day || !metricsEnabled()) return;
  set(LAST, day); track("app_open");
}
