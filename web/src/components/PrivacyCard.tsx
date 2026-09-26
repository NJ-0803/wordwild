"use client";
import { useState } from "react";
import Link from "next/link";
import { metricsEnabled, resetDeviceId, respectsSignal, setMetricsEnabled } from "@/lib/metrics";
import { Btn, Card } from "./ui";

/** The one place that explains, in plain words, what the anonymous counts are, and lets the person stop or reset them. */
export function PrivacyCard() {
  const [on, setOn] = useState(() => metricsEnabled()); const [note, setNote] = useState<string | null>(null);
  const signal = respectsSignal();
  return (
    <Card>
      <h2 style={{ marginBottom: 6 }}>Help us improve, privately</h2>
      <p className="sub small">We count that things happen, for example &ldquo;a word was saved&rdquo; or &ldquo;a lookup found nothing&rdquo;, so we can fix what does not work. We never send the words you look up, your sentences, your name, your email, your address or which pages you view. The counts are tied to a random number on this device, not to you.</p>
      {signal && <p className="sub small"><b>Your browser asks sites not to track, so counting is off.</b></p>}
      <Btn kind={on && !signal ? "primary" : "soft"} disabled={signal} aria-pressed={on && !signal} onClick={() => { const n = !on; setMetricsEnabled(n); setOn(n); setNote(n ? "Counting is on." : "Counting is off, and the random number on this device was deleted."); }}>{on && !signal ? "Counting is on: turn it off" : "Counting is off: turn it on"}</Btn>
      <Btn kind="ghost" onClick={() => { resetDeviceId(); setNote("The random number on this device was deleted. A new one is made next time."); }}>Forget my random number</Btn>
      {note && <p role="status" className="sub small">{note}</p>}
      <p className="sub small"><Link href="/privacy">Read the full privacy policy</Link></p>
    </Card>
  );
}
