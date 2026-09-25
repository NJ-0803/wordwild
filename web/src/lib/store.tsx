"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { exportEvents, freshState, mergeEvents, rebuildState, restore, serialize, type LearnerState, type Prefs, type SyncEvents } from "@core";

const KEY = "wordwild.state.v2", OB = "wordwild.onboarded", OWNER = "wordwild.owner", PREFS_AT = "wordwild.prefsAt";
export type SyncStatus = "off" | "syncing" | "synced" | "offline" | "error";

interface Server extends SyncEvents { prefs: Prefs | null; prefsUpdatedAt: number }
interface Ctx {
  state: LearnerState; ready: boolean; recovered: "ok" | "migrated" | "reset";
  update: (f: (s: LearnerState) => LearnerState) => void;
  now: () => number; skipDay: () => void; devOffsetDays: number;
  onboarded: boolean; finishOnboarding: () => void;
  sync: SyncStatus; deleteAccountData: () => Promise<boolean>;
}
const C = createContext<Ctx>(null as unknown as Ctx);
export const useStore = () => useContext(C);

const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* memory only */ } };
const evKey = (e: { key?: string; kind?: string; query?: string; senseId?: string | null }) => e.kind ? `t:${e.key}` : e.key ? `a:${e.key}` : `c:${e.senseId ?? "pending:" + e.query}`;

async function api(method: string, body?: unknown): Promise<Server> {
  const r = await fetch("/api/sync", { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw Object.assign(new Error("sync " + r.status), { status: r.status });
  return r.json();
}

/**
 * Local-first store. Guests keep everything on the device. Signed-in learners also sync: grow-only events are pulled,
 * merged with local ones, the state is rebuilt by the shared engine, and only events the server lacks are pushed.
 */
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [state, setState] = useState<LearnerState>(freshState());
  const [ready, setReady] = useState(false);
  const [recovered, setRecovered] = useState<"ok" | "migrated" | "reset">("ok");
  const [offset, setOffset] = useState(0);
  const [onboarded, setOnboarded] = useState(false);
  const [sync, setSync] = useState<SyncStatus>("off");
  const ref = useRef(state);                       // always the latest state; written only in commit()
  const known = useRef(new Set<string>());         // event keys the server already has
  const synced = useRef(false);                    // initial pull/merge finished for this sign-in
  const busy = useRef(false);
  const wasSignedIn = useRef(false);

  const commit = useCallback((next: LearnerState) => { ref.current = next; setState(next); lsSet(KEY, serialize(next)); }, []);

  useEffect(() => {
    // Loading from localStorage is syncing with an external system, which is what effects are for.
    /* eslint-disable react-hooks/set-state-in-effect */
    const r = restore(lsGet(KEY));
    ref.current = r.state; setState(r.state); setRecovered(r.recovered);
    setOnboarded(lsGet(OB) === "1");
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => { document.documentElement.style.setProperty("--scale", String(state.prefs.textScale)); }, [state.prefs.textScale]);

  const update = useCallback((f: (s: LearnerState) => LearnerState) => {
    const prev = ref.current, next = f(prev);
    if (next.prefs !== prev.prefs) lsSet(PREFS_AT, String(Date.now()));
    commit(next);
  }, [commit]);

  /** Push whatever the server does not have yet. Safe to call repeatedly; failures leave events queued locally. */
  const push = useCallback(async () => {
    if (!synced.current || busy.current) return;
    const local = exportEvents(ref.current);
    const fresh = { captures: local.captures.filter(c => !known.current.has(evKey(c))).slice(0, 200), attempts: local.attempts.filter(a => !known.current.has(evKey(a))).slice(0, 500), town: (local.town ?? []).filter(t => !known.current.has(evKey(t))).slice(0, 100) };
    const prefsAt = Number(lsGet(PREFS_AT) ?? 0);
    if (!fresh.captures.length && !fresh.attempts.length && !fresh.town.length && !prefsAt) return;
    busy.current = true; setSync("syncing");
    try {
      const res = await api("POST", { ...fresh, prefs: ref.current.prefs, prefsUpdatedAt: prefsAt });
      [...res.captures, ...res.attempts, ...(res.town ?? [])].forEach(e => known.current.add(evKey(e)));
      lsSet(PREFS_AT, null);
      setSync("synced");
    } catch (e) { setSync((e as { status?: number }).status ? "error" : "offline"); }
    finally { busy.current = false; }
  }, []);

  /** First step after sign-in: pull, merge, rebuild, then push the rest. */
  const firstSync = useCallback(async (uid: string) => {
    busy.current = true; setSync("syncing");
    try {
      const server = await api("GET");
      const foreign = lsGet(OWNER) && lsGet(OWNER) !== uid;   // data on this device belongs to someone else: never upload it
      const local = foreign ? { captures: [], attempts: [], town: [] } : exportEvents(ref.current);
      const merged = mergeEvents(local, server);
      const localPrefsAt = Number(lsGet(PREFS_AT) ?? 0);
      const prefs = !foreign && localPrefsAt > server.prefsUpdatedAt ? ref.current.prefs : server.prefs ?? (foreign ? undefined : ref.current.prefs);
      commit(rebuildState(merged, prefs));
      known.current = new Set([...server.captures, ...server.attempts, ...(server.town ?? [])].map(evKey));
      lsSet(OWNER, uid);
      synced.current = true; busy.current = false;
      await push();
      setSync(s => (s === "syncing" ? "synced" : s));
    } catch (e) { busy.current = false; setSync((e as { status?: number }).status === 503 ? "off" : (e as { status?: number }).status ? "error" : "offline"); }
  }, [commit, push]);

  useEffect(() => {
    if (!ready || !isLoaded) return;
    if (isSignedIn && userId) { wasSignedIn.current = true; if (!synced.current) void firstSync(userId); return; }
    if (wasSignedIn.current) {            // explicit sign-out in this session: clear the account's data from this device
      wasSignedIn.current = false; synced.current = false; known.current = new Set();
      lsSet(OWNER, null); lsSet(PREFS_AT, null); lsSet(OB, null); commit(freshState()); setOnboarded(false);
    }
  }, [ready, isLoaded, isSignedIn, userId, firstSync, commit]);

  // Push shortly after changes, and again when the connection returns.
  useEffect(() => { if (!synced.current) return; const t = setTimeout(() => void push(), 1500); return () => clearTimeout(t); }, [state, push]);
  useEffect(() => { const h = () => void push(); window.addEventListener("online", h); return () => window.removeEventListener("online", h); }, [push]);

  const deleteAccountData = useCallback(async () => {
    try { await api("DELETE"); } catch { return false; }
    synced.current = false; known.current = new Set(); lsSet(OWNER, null); lsSet(PREFS_AT, null);
    commit(freshState()); synced.current = true; setSync("synced");
    return true;
  }, [commit]);

  const now = useCallback(() => Date.now() + offset * 86_400_000, [offset]);
  const finishOnboarding = useCallback(() => { setOnboarded(true); lsSet(OB, "1"); }, []);
  return <C.Provider value={{ state, ready, recovered, update, now, skipDay: () => setOffset(o => o + 1), devOffsetDays: offset, onboarded, finishOnboarding, sync: isSignedIn ? sync : "off", deleteAccountData }}>{children}</C.Provider>;
}
