"use client";
import { useEffect, useRef, useState } from "react";

/** True while the element is on screen AND the tab is visible. Animations and render loops use it to stop doing work nobody can see. */
export function useLive<T extends HTMLElement>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  useEffect(() => {
    const el = ref.current; if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: "120px" });
    io.observe(el); return () => io.disconnect();
  }, []);
  useEffect(() => {
    const on = () => setTabVisible(document.visibilityState === "visible");
    on(); document.addEventListener("visibilitychange", on); return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return [ref, inView && tabVisible];
}
