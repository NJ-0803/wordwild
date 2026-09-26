"use client";
import { useEffect, useState } from "react";
import { useReducedMotion } from "@/lib/motion";

const SCENES = [
  { key: "download", label: "Download and unzip", url: "Downloads", cap: "Double-click the zip. A folder called wordwild-extension appears." },
  { key: "open", label: "Open the extensions page", url: "chrome://extensions", cap: "Paste chrome://extensions in a new tab and press Enter." },
  { key: "dev", label: "Turn on Developer mode", url: "chrome://extensions", cap: "Switch on Developer mode, top right." },
  { key: "load", label: "Load unpacked", url: "chrome://extensions", cap: "Click Load unpacked, choose the folder, press Select." },
  { key: "try", label: "Try it", url: "any website", cap: "Refresh a page, select a word, press any key." },
] as const;

/** A short looping picture-guide of the five steps. Drawn in HTML, so it is tiny, sharp, and never out of date with the real page. */
export function InstallGuide() {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0); const [play, setPlay] = useState(true);
  useEffect(() => { if (!play || reduced) return; const t = setTimeout(() => setI(n => (n + 1) % SCENES.length), 3600); return () => clearTimeout(t); }, [i, play, reduced]);
  const s = SCENES[i];
  return (
    <section className="ig" aria-label="Picture guide: how to add the extension">
      <div className="ig-win" role="img" aria-label={`Step ${i + 1}: ${s.cap}`}>
        <div className="ig-bar"><span /><span /><span /><em>{s.url}</em></div>
        <div className="ig-body" key={s.key}>
          {s.key === "download" && <div className="ig-c ig-dl"><div className="ig-file zip"><b>ZIP</b><small>wordwild-extension.zip</small></div><div className="ig-arrow" aria-hidden>→</div><div className="ig-file dir"><b>▤</b><small>wordwild-extension</small></div></div>}
          {s.key === "open" && <div className="ig-c"><div className="ig-addr"><span className="ig-type">chrome://extensions</span><i className="ig-caret" /></div><p className="ig-note">New tab</p></div>}
          {s.key === "dev" && <div className="ig-c ig-ext"><div className="ig-top"><b>Extensions</b><label className="ig-tg on"><span>Developer mode</span><i /></label></div><p className="ig-note">It stays on. This lets Chrome load Wordwild.</p></div>}
          {s.key === "load" && <div className="ig-c ig-ext"><div className="ig-top"><span className="ig-b hot">Load unpacked</span><span className="ig-b">Pack extension</span><span className="ig-b">Update</span></div><div className="ig-pick"><div className="ig-row">▤ Documents</div><div className="ig-row sel">▤ wordwild-extension</div><span className="ig-b hot small">Select</span></div></div>}
          {s.key === "try" && <div className="ig-c ig-page"><p>Some people learn a new word every day, and <mark>serendipity</mark> is one worth knowing.</p><div className="ig-card"><b>serendipity</b><span>good luck in making unexpected and fortunate discoveries</span></div></div>}
        </div>
      </div>
      <p className="ig-cap" role="status">{i + 1}. {s.cap}</p>
      <div className="ig-ctl">
        {SCENES.map((x, n) => <button key={x.key} className={n === i ? "on" : ""} onClick={() => { setI(n); setPlay(false); }} aria-label={`Show step ${n + 1}: ${x.label}`} aria-current={n === i}>{n + 1}</button>)}
        {!reduced && <button className="ig-play" onClick={() => setPlay(p => !p)}>{play ? "Pause" : "Play"}</button>}
      </div>
    </section>
  );
}
