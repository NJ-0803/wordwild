"use client";
import { useCallback, useEffect, useState } from "react";

/** State kept in this browser, per key (used for today's puzzle progress). Falls back to memory if storage is blocked. */
export function usePersisted<T>(key: string, initial: T): [T, (f: (v: T) => T) => void, boolean] {
  const [v, setV] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try { const raw = localStorage.getItem(key); if (raw) setV(JSON.parse(raw) as T); } catch { /* memory only */ }
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [key]);
  const set = useCallback((f: (v: T) => T) => setV(prev => { const n = f(prev); try { localStorage.setItem(key, JSON.stringify(n)); } catch { /* memory only */ } return n; }), [key]);
  return [v, set, ready];
}
