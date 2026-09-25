"use client";
import { useState } from "react";
import { renderCard, shareOrSave, type CardSpec } from "@/lib/shareCard";
import { Btn } from "./ui";
import { track } from "@/lib/metrics";

/** Draws a card in the browser and shares or saves it. Nothing leaves the device unless the person picks where to send it. */
export function ShareButton({ spec, filename, text, label = "Share as a card", kind = "word" }: { kind?: "word" | "vault"; spec: () => CardSpec; filename: string; text: string; label?: string }) {
  const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true); setMsg(null);
    try { const r = await shareOrSave(await renderCard(spec()), filename, text); if (r !== "cancelled") track("share_card", kind); setMsg(r === "saved" ? "Saved as an image. You can send it from your files." : r === "shared" ? "Shared." : null); }
    catch { setMsg("Could not make the card on this device."); }
    setBusy(false);
  };
  return <><Btn kind="soft" icon="🖼️" onClick={go} disabled={busy}>{busy ? "Making your card…" : label}</Btn>{msg && <p role="status" className="sub small">{msg}</p>}</>;
}
