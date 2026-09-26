"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Btn, Card, LinkBtn } from "@/components/ui";
import { Orb } from "@/components/Companion";
import { Icon } from "@/components/Icons";

const ZIP = "/wordwild-extension.zip";

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <div className="row" style={{ alignItems: "flex-start", justifyContent: "flex-start", gap: 16 }}>
        <span aria-hidden style={{ flex: "0 0 auto", width: 44, height: 44, borderRadius: "50%", display: "grid", placeItems: "center", background: "linear-gradient(180deg, var(--navy-2), var(--navy))", border: "1px solid var(--navy-glow)", font: "600 1.3rem var(--font-mono), monospace" }}>{n}</span>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: "1.35rem" }}>{title}</h2>
          <div className="stack" style={{ gap: 8 }}>{children}</div>
        </div>
      </div>
    </Card>
  );
}

/** Do-it-yourself install for people who want the extension now, without the Chrome Web Store. */
export default function ExtensionPage() {
  const [copied, setCopied] = useState(false);
  const [browser, setBrowser] = useState<"chromium" | "firefox" | "safari" | "phone" | null>(null);
  /* eslint-disable react-hooks/set-state-in-effect -- reading the browser on load is syncing with an external source */
  useEffect(() => {
    const ua = navigator.userAgent;
    setBrowser(/Android|iPhone|iPad|iPod/i.test(ua) ? "phone" : /Firefox\//.test(ua) ? "firefox" : /Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\//.test(ua) ? "safari" : "chromium");
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  const copy = async () => { try { await navigator.clipboard.writeText("chrome://extensions"); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* the address is shown so it can be typed */ } };

  return (
    <div className="stack" style={{ maxWidth: 860 }}>
      <div className="hero-band"><Orb size={96} label="Wordwild extension" still /><div style={{ flex: 1 }}><h1 className="display" style={{ margin: 0 }}>Add Wordwild to Chrome</h1>
        <p className="sub" style={{ margin: "6px 0 0", fontSize: "1.1rem" }}>Select a word on any website, press a key, see the meaning next to it. Free. Takes about two minutes.</p></div></div>

      {browser === "phone" && <Card tone="warn"><b>This needs Chrome on a computer.</b><p className="sub small" style={{ margin: "4px 0 0" }}>Chrome on phones does not allow extensions. On your phone, use the Wordwild website directly.</p></Card>}
      {browser === "firefox" && <Card tone="warn"><b>This version is for Chrome and browsers built on it.</b><p className="sub small" style={{ margin: "4px 0 0" }}>It also works in Edge, Brave and Opera on a computer. Firefox needs a different package, which is not ready yet.</p></Card>}
      {browser === "safari" && <Card tone="warn"><b>Safari cannot load this.</b><p className="sub small" style={{ margin: "4px 0 0" }}>Open this page in Chrome, Edge or Brave on a computer.</p></Card>}

      <Step n={1} title="Download and unzip">
        <p className="sub" style={{ margin: 0 }}>Download the file, then open your Downloads folder and double-click it. A folder called <b>wordwild-extension</b> appears. Keep that folder somewhere you will not delete it, for example Documents: Chrome reads the extension from it.</p>
        <LinkBtn href={ZIP}>Download the extension (35 KB)</LinkBtn>
      </Step>

      <Step n={2} title="Open Chrome's extensions page">
        <p className="sub" style={{ margin: 0 }}>Websites are not allowed to open this page for you. Open a new tab, paste the address below, and press Enter.</p>
        <div className="row" style={{ justifyContent: "flex-start" }}>
          <code style={{ flex: 1, padding: "14px 16px", borderRadius: 14, background: "#070a14", border: "1px solid var(--line)", fontFamily: "var(--font-mono), monospace", fontSize: "1.05rem" }}>chrome://extensions</code>
          <div style={{ flex: "0 0 auto" }}><Btn kind="soft" onClick={copy} style={{ width: "auto", minWidth: 110 }}>{copied ? "Copied" : "Copy"}</Btn></div>
        </div>
        <p className="sub small" style={{ margin: 0 }}>On Edge use <code>edge://extensions</code>, on Brave <code>brave://extensions</code>.</p>
      </Step>

      <Step n={3} title="Turn on Developer mode">
        <p className="sub" style={{ margin: 0 }}>Find the switch called <b>Developer mode</b> at the top right of that page and turn it on. It stays on. This is what lets Chrome load an extension that is not from the store.</p>
      </Step>

      <Step n={4} title="Click “Load unpacked” and choose the folder">
        <p className="sub" style={{ margin: 0 }}>Three buttons appear at the top left. Click <b>Load unpacked</b>, then pick the <b>wordwild-extension</b> folder from step 1 (the folder that contains a file called manifest.json) and press <b>Select</b>. Grey file names in the picker are normal: you are choosing a folder, not a file.</p>
      </Step>

      <Step n={5} title="Try it">
        <p className="sub" style={{ margin: 0 }}>Open any article and <b>refresh it</b> (pages that were already open do not have the extension yet). Double-click a word, then press any letter key. A card with the meaning appears next to the word. Click the puzzle-piece icon in Chrome&rsquo;s toolbar and pin Wordwild to keep it handy.</p>
        <p className="sub small" style={{ margin: 0 }}>Nothing happens inside a text box on purpose, so it never gets in the way of typing.</p>
      </Step>

      <Card>
        <h2 style={{ marginTop: 0 }}>If something goes wrong</h2>
        <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8 }}>
          <li><b>Nothing appears.</b> Refresh the page you are reading, then select the word again and press a letter key.</li>
          <li><b>“Extension context invalidated”.</b> This appears after Chrome reloads the extension. Refresh the page.</li>
          <li><b>Chrome says the extension is unsafe or from an unknown source.</b> That is Chrome&rsquo;s standard message for any extension loaded this way. The extension is open to read: it only asks to reach wordwild-seven.vercel.app.</li>
          <li><b>Chrome asks whether to keep developer-mode extensions when it starts.</b> Choose to keep them.</li>
          <li><b>To update,</b> download the file again, replace the folder, then press the round reload arrow on Wordwild in the extensions page.</li>
        </ul>
      </Card>

      <Card tone="good">
        <h2 style={{ marginTop: 0 }}>What it does and does not do</h2>
        <p style={{ margin: 0 }}>Only the word you select is sent to Wordwild, and only when you press the key. It does not read the page, your history or anything you type. There are no ads and no tracking. <Link href="/privacy">Read the privacy policy</Link>.</p>
      </Card>

      <div className="row" style={{ justifyContent: "flex-start" }}><Icon.Puzzle width={18} height={18} /><span className="sub small">Version 1.0.2</span></div>
      <LinkBtn href="/" kind="ghost">Back</LinkBtn>
    </div>
  );
}
