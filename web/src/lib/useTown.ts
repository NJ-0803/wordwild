"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildBuilding, claimOrder, finishScene, seenScenes, townView, type TownView } from "@core";
import { useStore } from "./store";

/** The town as the learner sees it, derived from their real learning events. Re-evaluated every minute so ripe crops appear on time. */
export function useTown() {
  const { state, update, now, ready } = useStore();
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 60_000); return () => clearInterval(t); }, []);
  const tz = useMemo(() => -new Date().getTimezoneOffset(), []);
  const view: TownView = useMemo(() => townView(state, now(), tz), [state, now, tz, tick]);       // eslint-disable-line react-hooks/exhaustive-deps

  const build = useCallback((id: string) => {
    const r = buildBuilding(state, id, now());
    if (r.ok) update(s => { const x = buildBuilding(s, id, now()); return x.ok ? x.state : s; });
    return r.ok ? { ok: true as const } : r;
  }, [state, update, now]);
  const claim = useCallback((ref: string) => {
    const r = claimOrder(state, ref, now());
    if (r.ok) update(s => { const x = claimOrder(s, ref, now()); return x.ok ? x.state : s; });
    return r.ok ? { ok: true as const } : r;
  }, [state, update, now]);
  const finish = useCallback((id: string) => {
    const r = finishScene(state, id, now());
    if (r.ok) update(s => { const x = finishScene(s, id, now()); return x.ok ? x.state : s; });
    return r.ok ? { ok: true as const } : r;
  }, [state, update, now]);
  const seen = useMemo(() => seenScenes(state), [state]);
  return { view, ready, build, claim, finish, seen, state, hour: new Date(now()).getHours() };
}
