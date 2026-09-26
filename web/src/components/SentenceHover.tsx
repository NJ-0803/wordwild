"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { say } from "@/lib/speech";
import { Orb } from "./Companion";

interface Item { word: string; lemma: string; pos: string; simple: string; more: number; note?: string }
const cache = new Map<string, Item[]>();

// Words that carry no meaning worth looking up. The target word itself is skipped too, since the page is already about it.
const STOP = new Set(("the and for are but not you all any can had her was one our out has him his how its may new now old see two way who did get let put say she too use " +
  "that with have this will your from they know want been good much some time very when come here just like long make many over such take than them well were what would there their about which these other after again could every " +
  "first found where while being those under also into only then more most even because before should through during another between").split(" "));

/** Words worth explaining, in the order they appear, each once. */
export function contentWords(sentence: string, skip: string[] = []): string[] {
  const skipSet = new Set(skip.map(s => s.toLowerCase()));
  const out: string[] = [];
  for (const m of sentence.matchAll(/[A-Za-z][A-Za-z'-]{3,}/g)) { const w = m[0].toLowerCase().replace(/'s$/, ""); if (!STOP.has(w) && !skipSet.has(w) && !out.includes(w)) out.push(w); if (out.length >= 8) break; }
  return out;
}

/**
 * Wraps a sentence. While the pointer is over it (or it has focus, or it was tapped), a panel at its top right lists what the other words in it mean:
 * "You may also like these words". Works with a keyboard (focus) and touch (tap toggles). Nothing loads until the sentence is first touched.
 */
export function SentenceHover({ text, skip = [], children, style }: { text: string; skip?: string[]; children: React.ReactNode; style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [loading, setLoading] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const box = useRef<HTMLDivElement>(null); const panelRef = useRef<HTMLElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const words = contentWords(text, skip);
  const key = words.join("|");

  useEffect(() => {
    if (!open || !words.length || items) return;
    const hit = cache.get(key); if (hit) { setItems(hit); return; }        // eslint-disable-line react-hooks/set-state-in-effect
    let live = true; setLoading(true);
    fetch("/api/words", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ words }) })
      .then(r => (r.ok ? r.json() : { items: [] })).then((j: { items: Item[] }) => { cache.set(key, j.items); if (live) setItems(j.items); }).catch(() => { if (live) setItems([]); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [open, key, items, words.length]);   // eslint-disable-line react-hooks/exhaustive-deps

  // The panel is drawn at the page level (a portal) so no card, border or overflow can clip it. It sits at the sentence's top right:
  // beside the column when the screen is wide enough, otherwise over the sentence's right edge.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = box.current?.getBoundingClientRect(); if (!r) return;
      const width = Math.min(316, innerWidth - 24); const h = panelRef.current?.offsetHeight ?? 280;
      const beside = innerWidth - r.right >= width + 20;
      const left = beside ? r.right + 16 : Math.max(12, Math.min(r.right - width, innerWidth - width - 12));
      const top = Math.max(12, Math.min(r.top - (beside ? 0 : 6), innerHeight - h - 12));
      setPos({ top, left, width });
    };
    place(); addEventListener("scroll", place, true); addEventListener("resize", place);
    return () => { removeEventListener("scroll", place, true); removeEventListener("resize", place); };
  }, [open, items, loading]);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  const show = () => { if (closeTimer.current) clearTimeout(closeTimer.current); setOpen(true); };
  const hide = () => { closeTimer.current = setTimeout(() => setOpen(false), 220); };   // a short grace so the pointer can travel onto the panel
  if (!words.length) return <>{children}</>;
  return (
    <div ref={box} className="wh" style={{ position: "relative", ...style }} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      <div tabIndex={0} role="group" aria-label="Sentence. Hover, focus or tap to see what its words mean." onClick={() => setOpen(o => !o)} style={{ cursor: "help", outlineOffset: 4 }}>{children}</div>
      {open && typeof document !== "undefined" && createPortal(
        <aside ref={el => { panelRef.current = el; }} className="wh-panel" aria-live="polite" aria-label="Words in this sentence" onMouseEnter={show} onMouseLeave={hide}
          style={pos ? { top: pos.top, left: pos.left, width: pos.width } : { visibility: "hidden" }}>
          <p className="label" style={{ margin: "0 0 8px" }}>You may also like these words</p>
          {loading && <div style={{ display: "grid", placeItems: "center", padding: 8 }}><Orb state="searching" size={48} label="Looking up the words" /></div>}
          {items && items.length === 0 && <p className="sub small" style={{ margin: 0 }}>No extra meanings found for this sentence.</p>}
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            {items?.map(it => (
              <li key={it.word}>
                <div className="row" style={{ justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                  <b style={{ fontFamily: "var(--font-serif), Georgia, serif", fontWeight: 400, fontSize: "1.25rem" }}>{it.lemma}</b>
                  <span className="pill" style={{ flex: "0 0 auto" }}>{it.pos}</span>
                </div>
                <p className="small" style={{ margin: "2px 0 4px" }}>{it.simple}</p>
                <div className="row" style={{ justifyContent: "flex-start", gap: 10 }}>
                  <button className="chip" style={{ minHeight: 32, padding: "2px 10px", fontSize: ".8rem", flex: "0 0 auto" }} onClick={e => { e.stopPropagation(); say(`${it.lemma}. ${it.simple}`); }} aria-label={`Listen to ${it.lemma}`}>🔊</button>
                  <Link className="small" href={`/capture?word=${encodeURIComponent(it.lemma)}`} onClick={e => e.stopPropagation()}>{it.more > 0 ? `${it.more} more meaning${it.more === 1 ? "" : "s"} · save` : "Save this word"}</Link>
                </div>
              </li>))}
          </ul>
        </aside>, document.body)}
    </div>
  );
}
