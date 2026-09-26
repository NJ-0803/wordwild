"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

/** The welcome (and the animation library it needs) is only downloaded on a visitor's very first visit. Everyone else never pays for it. */
const Welcome = dynamic(() => import("./Welcome").then(m => m.Welcome), { ssr: false });
export function WelcomeGate() {
  const [first, setFirst] = useState(false);
  useEffect(() => {
    let seen = false; try { seen = localStorage.getItem("ww.welcomed") === "1" || localStorage.getItem("wordwild.onboarded") === "1"; } catch { /* first visit */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a one-time flag from storage
    if (!seen) setFirst(true);
  }, []);
  return first ? <Welcome /> : null;
}
