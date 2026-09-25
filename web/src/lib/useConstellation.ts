"use client";
import { useEffect, useMemo, useState } from "react";
import { estimateLevel, masteryLevel, type LevelEstimate, type Pick } from "@core";
import { useStore } from "./store";
import { getSenseSync, useLemmas } from "./senses";

export interface ConstellationData { target: { lemma: string; level: number }; picks: Pick[]; mode: "ai" | "dictionary-only" }
export type ConstellationState = { status: "loading" } | { status: "error"; reason: string } | { status: "ready"; data: ConstellationData };

/** Learner level = what they told us (optional) blended with the difficulty of words they have really practised. Lookups are NOT evidence. */
export function useLearnerLevel(): LevelEstimate {
  const { state } = useStore();
  return useMemo(() => {
    const practised = Object.values(state.senses)
      .filter(r => ["practising", "secure"].includes(masteryLevel(r)))
      .map(r => getSenseSync(r.senseId)?.difficulty).filter((d): d is 1 | 2 | 3 | 4 | 5 => !!d);
    return estimateLevel(state.prefs.profile, practised);
  }, [state.senses, state.prefs.profile]);
}

export function useConstellation(senseId: string): { state: ConstellationState; est: LevelEstimate; retry: () => void } {
  const { state: app } = useStore();
  const est = useLearnerLevel();
  const lemmas = useLemmas(Object.keys(app.senses));
  const [res, setRes] = useState<ConstellationState>({ status: "loading" });
  const [tick, setTick] = useState(0);
  const interests = (app.prefs.profile?.interests ?? []).join(",");
  const purpose = app.prefs.profile?.purpose;
  const exclude = useMemo(() => Object.values(lemmas).join(","), [lemmas]);
  const level = Math.round(est.level * 10) / 10;

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await fetch("/api/constellation", { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ senseId, learner: { level, interests: interests ? interests.split(",") : [], purpose }, exclude: exclude ? exclude.split(",") : [] }) });
        if (!r.ok) throw new Error(r.status === 503 ? "not-configured" : "unavailable");
        const data = await r.json() as ConstellationData;
        if (live) setRes({ status: "ready", data });
      } catch (e) { if (live) setRes({ status: "error", reason: (e as Error).message }); }
    })();
    return () => { live = false; };
  }, [senseId, level, interests, purpose, exclude, tick]);

  return { state: res, est, retry: () => { setRes({ status: "loading" }); setTick(t => t + 1); } };
}
