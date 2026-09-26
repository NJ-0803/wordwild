"use client";
import { useCallback, useEffect, useState } from "react";
import { Show } from "@clerk/nextjs";
import Link from "next/link";
import { GAMES, GAME_LABEL, LEVELS, LEVEL_LABEL, formatTime, type Game } from "@core";
import { useTown } from "@/lib/useTown";

interface Row { pid: string; name: string; game: string; level: string; ms: number; tries: number; won: boolean; me: boolean }
interface Data { me: { name: string; code: string; pid: string }; friends: { pid: string; name: string }[]; rows: Row[] }

/** Friends' times for today's puzzles, LinkedIn-style: who has finished, and how fast. It only shows people who chose to be your friend. */
export function Friends() {
  return (
    <section className="card fr" aria-labelledby="fr-h">
      <h2 id="fr-h" style={{ marginBottom: 6 }}>Friends today</h2>
      <Show when="signed-out"><p className="sub" style={{ margin: 0 }}>Sign in to invite friends and see who finished today&apos;s puzzles fastest.</p><p><Link className="btn" href="/sign-in" style={{ width: "auto", display: "inline-flex" }}>Sign in</Link></p></Show>
      <Show when="signed-in"><Board /></Show>
    </section>
  );
}

function Board() {
  const { day } = useTown();
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const load = useCallback(() => fetch(`/api/friends?day=${day}`).then(async r => { if (!r.ok) throw new Error(String(r.status)); setD(await r.json()); setErr(""); }).catch(() => setErr("Friends are not available right now.")), [day]);
  useEffect(() => { let live = true; fetch(`/api/friends?day=${day}`).then(async r => { if (!r.ok) throw new Error(); const j = await r.json(); if (live) setD(j); }).catch(() => { if (live) setErr("Friends are not available right now."); }); return () => { live = false; }; }, [day]);
  if (err) return <p className="sub">{err}</p>;
  if (!d) return <p className="sub" role="status">Loading…</p>;
  const link = `${location.origin}/join/${d.me.code}`;
  const copy = async () => { try { await navigator.clipboard.writeText(`Play today's Wordwild puzzles with me: ${link}`); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* the link is shown below */ } };
  const groups: { title: string; rows: Row[] }[] = [];
  for (const g of GAMES) {
    if (g === "unscramble") for (const l of LEVELS) groups.push({ title: `${GAME_LABEL[g as Game].title} · ${LEVEL_LABEL[l]}`, rows: d.rows.filter(r => r.game === g && r.level === l) });
    else groups.push({ title: GAME_LABEL[g as Game].title, rows: d.rows.filter(r => r.game === g) });
  }
  const shown = groups.filter(g => g.rows.length);
  return (
    <>
      <p className="sub small" style={{ margin: "0 0 10px" }}>{d.friends.length ? `${d.friends.length} ${d.friends.length === 1 ? "friend" : "friends"}. Only your first name and your times are shared, and only with friends.` : "No friends yet. Send your link; when a friend opens it, you both appear here."}</p>
      <div className="row" style={{ justifyContent: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <button className="btn soft" style={{ width: "auto", minHeight: 46 }} onClick={() => void copy()}>{copied ? "Link copied" : "Copy invite link"}</button>
        <button className="pz-link" onClick={() => void load()}>Refresh</button>
      </div>
      <p className="sub small" style={{ wordBreak: "break-all" }}>{link}</p>
      {shown.length === 0 ? <p className="sub">Nobody has finished a puzzle today yet. Be the first.</p> : shown.map(g => (
        <div key={g.title} className="fr-group">
          <h3>{g.title}</h3>
          <ol className="fr-list">{g.rows.map((r, i) => (
            <li key={r.pid + r.level} className={r.me ? "me" : ""}><span className="fr-pos">{i + 1}</span><span className="fr-name">{r.me ? "You" : r.name}</span><span className="fr-time">{r.won ? formatTime(r.ms) : "did not solve"}{r.game === "word" && r.won ? ` · ${r.tries}/6` : ""}</span></li>))}</ol>
        </div>))}
      {d.friends.length > 0 && <details className="fr-manage"><summary>Manage friends</summary>
        <ul>{d.friends.map(f => <li key={f.pid}>{f.name} <button className="pz-link" onClick={async () => { await fetch("/api/friends/leave", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pid: f.pid }) }); void load(); }}>Remove</button></li>)}</ul></details>}
    </>
  );
}
