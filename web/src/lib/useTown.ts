"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildBuilding, claimOrder, finishPlay, finishScene, playedToday, playRef, seenScenes, townView, type TownView } from "@core";
import { dayIndex, type Game } from "@core";
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
  const play = useCallback((game: Game) => {
    const ref = playRef(game, dayIndex(now(), tz));
    const r = finishPlay(state, ref, now());
    if (r.ok) update(s => { const x = finishPlay(s, ref, now()); return x.ok ? x.state : s; });
    return r.ok;
  }, [state, update, now, tz]);
  const played = useMemo(() => playedToday(state, dayIndex(now(), tz)), [state, now, tz, tick]);   // eslint-disable-line react-hooks/exhaustive-deps
  const seen = useMemo(() => seenScenes(state), [state]);
  return { view, ready, build, claim, finish, play, played, day: dayIndex(now(), tz), seen, state, hour: (() => { const o = typeof window !== "undefined" ? Number(new URLSearchParams(window.location.search).get("hour")) : NaN; if (Number.isFinite(o) && new URLSearchParams(window.location.search).has("hour")) return Math.min(24, Math.max(0, o)); const t = new Date(now()); return t.getHours() + t.getMinutes() / 60; })() };
}
