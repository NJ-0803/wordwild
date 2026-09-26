"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { capture, safeLookup } from "@core";
import { WebDictionary } from "@/lib/senses";
import { Lumi } from "./Companion";
import { useStore } from "@/lib/store";

interface Item { id: string; lemma: string }
const provider = new WebDictionary();

/**
 * Words quick-saved with the Chrome extension while reading (or watching something) wait on the device. When the website opens, this offers
 * to add them: "You saved 3 new words. Want to look?". The extension's bridge script hands them over; nothing goes through a server.
 */
export function QuickSaved() {
  const { ready, update, now, state, onboarded } = useStore();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState(false);
  const stateRef = useRef(state); useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    const on = (e: MessageEvent) => {
      const d = e.data as { source?: string; type?: string; words?: unknown } | null;
      if (e.source !== window || e.origin !== window.location.origin || d?.source !== "wordwild-extension" || d.type !== "queue" || !Array.isArray(d.words)) return;
      const clean = d.words.filter((w): w is Item => !!w && typeof (w as Item).id === "string" && typeof (w as Item).lemma === "string" && /^[\p{L}][\p{L}' -]{0,39}$/u.test((w as Item).lemma)).slice(0, 100);
      setItems(clean); setGone(false);
    };
    window.addEventListener("message", on);
    window.postMessage({ source: "wordwild-page", type: "hello" }, window.location.origin);
    return () => window.removeEventListener("message", on);
  }, []);

  const add = useCallback(async (look: boolean) => {
    setBusy(true);
    try {
      for (const it of items) {
        const result = await safeLookup(provider, it.lemma, 8000);
        update(s => capture(s, result, { source: "Extension", senseId: it.id, now: now() }).state);
      }
      window.postMessage({ source: "wordwild-page", type: "ack", ids: items.map(i => i.id) }, window.location.origin);
      setItems([]);
      if (look) router.push("/notebook");
    } finally { setBusy(false); }
  }, [items, update, now, router]);

  if (!ready || !onboarded || gone || !items.length) return null;
  return (
    <aside className="quick" role="status">
      <div className="hero" style={{ gap: 12, marginBottom: 10 }}><Lumi size={52} /><p style={{ margin: 0 }}><b>You saved {items.length === 1 ? "a new word" : `${items.length} new words`}</b> while you were reading: {items.slice(0, 4).map(i => i.lemma).join(", ")}{items.length > 4 ? "…" : ""}. Want to look?</p></div>
      <div className="quick-b">
        <button className="btn" disabled={busy} onClick={() => void add(true)}>{busy ? "Adding…" : "Look at them"}</button>
        <button className="btn soft" disabled={busy} onClick={() => void add(false)}>Just add</button>
        <button className="pz-link" onClick={() => setGone(true)}>Later</button>
      </div>
    </aside>
  );
}
