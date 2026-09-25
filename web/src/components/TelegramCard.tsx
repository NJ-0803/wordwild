"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Btn, Card } from "./ui";

type Info = { configured: boolean; linked: { hour: number; tz: number; lang: string } | null };
const tz = () => -new Date().getTimezoneOffset();

/** One word a day on Telegram. Linking uses a one-time code; nothing is sent until the learner chooses to link. */
export function TelegramCard() {
  const { isSignedIn } = useAuth();
  const [info, setInfo] = useState<Info | null>(null); const [msg, setMsg] = useState("");
  const load = () => fetch("/api/telegram/link").then(r => r.ok ? r.json() : null).then(j => setInfo(j)).catch(() => setInfo(null));
  useEffect(() => { if (isSignedIn) void load(); }, [isSignedIn]);
  if (!isSignedIn || !info) return null;
  if (!info.configured) return <Card><h2>Daily word on Telegram</h2><p className="sub small">Not switched on on this server yet.</p></Card>;
  const link = async () => { setMsg(""); const r = await fetch("/api/telegram/link", { method: "POST" }); const j = await r.json().catch(() => ({})) as { url?: string }; if (j.url) { window.open(j.url, "_blank", "noopener"); setMsg("Telegram opened. Press Start there, then come back and refresh this page."); } else setMsg("Could not make a link right now."); };
  const save = async (hour: number, lang: string) => { await fetch("/api/telegram/link", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ hour, tz: tz(), lang }) }); await load(); };
  const unlink = async () => { await fetch("/api/telegram/link", { method: "DELETE" }); setMsg("Turned off."); await load(); };
  return (
    <Card>
      <h2>Daily word on Telegram</h2>
      {!info.linked ? (<>
        <p className="sub small">One word a day, and you can also message any word to the bot to learn its meaning. Skipped days cost nothing.</p>
        <Btn onClick={link}>Connect Telegram</Btn>
      </>) : (<div className="stack">
        <p role="status"><b>Connected.</b> You get one word a day.</p>
        <label className="sub small" htmlFor="tg-hour">Send it at</label>
        <select id="tg-hour" value={info.linked.hour} onChange={e => save(Number(e.target.value), info.linked!.lang)} style={{ minHeight: 48, borderRadius: 12, padding: 8, font: "inherit" }}>
          {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{`${h % 12 || 12}:00 ${h < 12 ? "am" : "pm"}`}</option>)}
        </select>
        <div className="row"><Btn kind={info.linked.lang === "hi" ? "primary" : "ghost"} onClick={() => save(info.linked!.hour, "hi")}>हिन्दी + English</Btn><Btn kind={info.linked.lang === "en" ? "primary" : "ghost"} onClick={() => save(info.linked!.hour, "en")}>English</Btn></div>
        <Btn kind="ghost" onClick={unlink}>Turn off</Btn>
      </div>)}
      {msg && <p role="status" className="small">{msg}</p>}
    </Card>
  );
}
