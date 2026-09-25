"use client";
import { useEffect, useMemo, useRef } from "react";
import { counts, dailyJourney, type Counts } from "@core";
import { useStore } from "@/lib/store";
import { track, trackOpenOncePerDay } from "@/lib/metrics";
import { deltaEvents } from "@core";

/** Reports that something happened (a word saved, a practice done), never what. Reads only the counts in the learner's state. */
export function MetricsWatcher() {
  const { state, ready, now } = useStore();
  const prev = useRef<Counts | null>(null); const journeyDone = useRef<boolean | null>(null);
  const tz = useMemo(() => -new Date().getTimezoneOffset(), []);
  useEffect(() => { if (ready) trackOpenOncePerDay(); }, [ready]);
  useEffect(() => {
    if (!ready) return;
    const c = counts(state);
    if (prev.current) {
      const jump = c.saved - prev.current.saved > 3 || c.practised - prev.current.practised > 3;       // a big jump is a sync merge, not something the person just did
      if (!jump) for (const e of deltaEvents(prev.current, c)) track(e.name);
    }
    prev.current = c;
    const done = dailyJourney(state, now(), tz).complete;
    if (journeyDone.current === false && done) track("journey_complete");
    journeyDone.current = done;
  }, [state, ready, now, tz]);
  return null;
}
