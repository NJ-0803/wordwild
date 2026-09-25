"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Btn, Card } from "./ui";

type Info = { configured: boolean; linked: { hour: number; tz: number; lang: string } | null };
const tz = () => -new Date().getTimezoneOffset();

/** One word a day on WhatsApp. Opt-in happens by sending a message from the learner's own phone; nothing is sent to a number that has not written to us. */
export function WhatsAppCard() {
  const { isSignedIn } = useAuth();
  const [info, setInfo] = useState<Info | null>(null); const [msg, setMsg] = useState("");
  const load = () => fetch("/api/whatsapp/link").then(r => r.ok ? r.json() : null).then(j => setInfo(j)).catch(() => setInfo(null));
  useEffect(() => { if (isSignedIn) void load(); }, [isSignedIn]);
  if (!isSignedIn || !info) return null;
  if (!info.configured) return <Card><h2>Daily word on WhatsApp</h2><p className="sub small">Not switched on on this server yet.</p></Card>;
  const link = async () => { setMsg(""); const r = await fetch("/api/whatsapp/link", { method: "POST" }); const j = await r.json().catch(() => ({})) as { url?: string }; if (j.url) { window.open(j.url, "_blank", "noopener"); setMsg("WhatsApp opened with a message ready. Press send there, then refresh this page."); } else setMsg("Could not make a link right now."); };
  const save = async (hour: number, lang: string) => { await fetch("/api/whatsapp/link", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ hour, tz: tz(), lang }) }); await load(); };
  const unlink = async () => { await fetch("/api/whatsapp/link", { method: "DELETE" }); setMsg("Turned off. Your number has been removed."); await load(); };
  return (
    <Card>
      <h2>Daily word on WhatsApp</h2>
      {!info.linked ? (<>
        <p className="sub small">One word a day, and you can message any word to get its meaning. When you press the button, WhatsApp opens with a message ready to send. Sending it links your number. We keep your number only for this, and sending STOP removes it. Skipped days cost nothing.</p>
        <Btn onClick={link}>Connect WhatsApp</Btn>
      </>) : (<div className="stack">
        <p role="status"><b>Connected.</b> You get one word a day.</p>
        <label className="sub small" htmlFor="wa-hour">Send it at</label>
        <select id="wa-hour" value={info.linked.hour} onChange={e => save(Number(e.target.value), info.linked!.lang)} style={{ minHeight: 48, borderRadius: 12, padding: 8, font: "inherit" }}>
          {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{`${h % 12 || 12}:00 ${h < 12 ? "am" : "pm"}`}</option>)}
        </select>
        <div className="row"><Btn kind={info.linked.lang === "hi" ? "primary" : "ghost"} onClick={() => save(info.linked!.hour, "hi")}>हिन्दी + English</Btn><Btn kind={info.linked.lang === "en" ? "primary" : "ghost"} onClick={() => save(info.linked!.hour, "en")}>English</Btn></div>
        <p className="sub small">If you have not written to us for a day, WhatsApp only lets us send an approved short message, so you may see a shorter version until you reply.</p>
        <Btn kind="ghost" onClick={unlink}>Turn off and remove my number</Btn>
      </div>)}
      {msg && <p role="status" className="small">{msg}</p>}
    </Card>
  );
}
