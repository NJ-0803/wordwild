"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

/** Press Cmd or Ctrl + K anywhere to save a word: type it, press Enter, done. */
export function QuickAdd() {
  const { onboarded } = useStore(); const router = useRouter();
  const [open, setOpen] = useState(false); const [q, setQ] = useState(""); const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); if (onboarded) setOpen(o => !o); } else if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on);
  }, [onboarded]);
  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 30); }, [open]);
  if (!open) return null;
  const go = () => { const t = q.trim(); if (!t) return; setOpen(false); setQ(""); router.push(`/capture?word=${encodeURIComponent(t.slice(0, 48))}`); };
  return (
    <div className="qa-back" onClick={() => setOpen(false)}>
      <form className="qa" role="dialog" aria-label="Save a word" onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); go(); }}>
        <input ref={input} value={q} onChange={e => setQ(e.target.value)} placeholder="Save a word…" aria-label="Word to save" autoComplete="off" spellCheck={false} />
        <small>Press Enter to save · Esc to close</small>
      </form>
    </div>
  );
}
