"use client";
import { useEffect, useState } from "react";
import { FixtureProvider, SENSE_BY_ID, isSenseId, type DictionaryProvider, type Sense } from "@core";

/** Route params may arrive encoded or already decoded; a WordNet key contains a literal % so decoding must never throw. */
export const safeDecode = (v: string) => { try { return decodeURIComponent(v); } catch { return v; } };

const KEY = "wordwild.senses.v1", MAX = 400;
type Cache = Record<string, Sense>;
const load = (): Cache => { try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; } };
const save = (c: Cache) => {
  const keys = Object.keys(c);
  if (keys.length > MAX) for (const k of keys.slice(0, keys.length - MAX)) delete c[k];   // oldest out first
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* storage full or blocked: fetch again next time */ }
};

/** Curated senses ship with the app; dictionary senses are cached on the device after the first fetch (works offline after that). */
export const getSenseSync = (id: string): Sense | undefined => SENSE_BY_ID[id] ?? load()[id];
export function cacheSenses(senses: Sense[]) { const c = load(); for (const s of senses) if (!SENSE_BY_ID[s.senseId]) c[s.senseId] = s; save(c); }   // enriched versions replace dictionary ones

export async function fetchSense(id: string): Promise<Sense | null> {
  const hit = getSenseSync(id); if (hit) return hit;
  if (!isSenseId(id)) return null;
  try {
    const r = await fetch(`/api/dict?id=${encodeURIComponent(id)}`); if (!r.ok) return null;
    const { sense } = await r.json() as { sense: Sense }; cacheSenses([sense]); return sense;
  } catch { return null; }
}

/** undefined = still loading, null = not available (offline and never cached, or unknown id). */
export function useSense(id: string): Sense | null | undefined {
  const [s, setS] = useState<Sense | null | undefined>(() => SENSE_BY_ID[id]);
  useEffect(() => {
    let live = true;
    void fetchSense(id).then(r => { if (live) setS(r); });
    return () => { live = false; };
  }, [id]);
  return s;
}

/** Curated words first (hand-checked, with practice); everything else comes from the WordNet-backed API. */
export class WebDictionary implements DictionaryProvider {
  readonly name = "wordwild";
  private fixtures = new FixtureProvider();
  private extras = new Map<string, { notes?: Record<string, string>; note?: string; suggestions?: string[]; hint?: string }>();
  meta(query: string) { return this.extras.get(query); }
  async lookup(query: string): Promise<Sense[] | null> {
    const curated = await this.fixtures.lookup(query); if (curated) return curated;
    const r = await fetch(`/api/dict?q=${encodeURIComponent(query)}`);
    if (!r.ok) throw new Error("dictionary-unavailable");
    const d = await r.json() as { status: string; senses?: Sense[]; notes?: Record<string, string>; note?: string; suggestions?: string[]; note2?: string };
    this.extras.set(query, { notes: d.notes, note: d.note, suggestions: d.suggestions, hint: d.status === "unknown" ? d.note : undefined });
    if (d.status === "found" && d.senses?.length) { cacheSenses(d.senses); return d.senses; }
    return null;
  }
}

export type EnrichResult = { ok: true; sense: Sense } | { ok: false; reason: "signin" | "not-configured" | "busy" | "rejected" | "quota" | "offline" | "error" };

/** Ask the server to prepare validated practice for a dictionary word (needs sign-in; server enforces quota and caching). */
export async function enrichSense(id: string): Promise<EnrichResult> {
  try {
    const r = await fetch("/api/enrich", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ senseId: id }) });
    if (r.ok) { const { sense } = await r.json() as { sense: Sense }; cacheSenses([sense]); return { ok: true, sense }; }
    if (r.status === 401) return { ok: false, reason: "signin" };
    if (r.status === 503) { const j = await r.json().catch(() => ({})) as { error?: string }; return { ok: false, reason: j.error === "busy" ? "busy" : "not-configured" }; }
    if (r.status === 422) return { ok: false, reason: "rejected" };
    if (r.status === 429) return { ok: false, reason: "quota" };
    return { ok: false, reason: "error" };
  } catch { return { ok: false, reason: "offline" }; }
}

/** Lemmas for a set of ids, fetching any that this device has not cached yet (e.g. right after signing in on a new device). */
export function useLemmas(ids: string[]): Record<string, string> {
  const key = ids.join("|");
  const [map, setMap] = useState<Record<string, string>>({});
  useEffect(() => {
    let live = true;
    (async () => {
      const out: Record<string, string> = {};
      for (const id of key ? key.split("|") : []) { const s = await fetchSense(id); if (s) out[id] = s.lemma; }
      if (live) setMap(out);
    })();
    return () => { live = false; };
  }, [key]);
  return map;
}
