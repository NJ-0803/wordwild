/**
 * A shareable image drawn in the browser. Nothing is uploaded: the person chooses whether to share or save it.
 * Black and navy like the site; the headline is Instrument Serif (falls back to Georgia if the font is not ready).
 */
export interface CardSpec { kicker: string; title: string; lines: { text: string; sub?: string }[]; footer: string; stats?: { value: string; label: string }[] }

const W = 1080, H = 1350;
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = []; let cur = "";
  for (const w of text.split(" ")) { const t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; }
  if (cur) out.push(cur); return out;
}

export async function renderCard(spec: CardSpec): Promise<Blob> {
  try { await document.fonts?.load('64px "Instrument Serif"'); await document.fonts?.load('32px "IBM Plex Mono"'); } catch { /* fall back to system fonts */ }
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d")!;
  x.fillStyle = "#04050a"; x.fillRect(0, 0, W, H);
  const g1 = x.createRadialGradient(W * 0.9, 0, 0, W * 0.9, 0, 900); g1.addColorStop(0, "rgba(40,80,190,.55)"); g1.addColorStop(1, "rgba(4,5,10,0)"); x.fillStyle = g1; x.fillRect(0, 0, W, H);
  const g2 = x.createRadialGradient(0, H, 0, 0, H, 800); g2.addColorStop(0, "rgba(25,55,140,.45)"); g2.addColorStop(1, "rgba(4,5,10,0)"); x.fillStyle = g2; x.fillRect(0, 0, W, H);
  // border light
  x.strokeStyle = "rgba(111,147,255,.55)"; x.lineWidth = 3; x.beginPath(); x.roundRect(36, 36, W - 72, H - 72, 44); x.stroke();
  const glow = x.createRadialGradient(W - 200, 220, 0, W - 200, 220, 160); glow.addColorStop(0, "#dfe7ff"); glow.addColorStop(0.25, "#6f93ff"); glow.addColorStop(0.7, "#14306f"); glow.addColorStop(1, "rgba(4,5,10,0)");
  x.fillStyle = glow; x.beginPath(); x.arc(W - 200, 220, 160, 0, Math.PI * 2); x.fill();

  x.textBaseline = "alphabetic"; x.fillStyle = "#a4aec6"; x.font = '500 30px "IBM Plex Mono", ui-monospace, Menlo, monospace';
  x.fillText(spec.kicker.toUpperCase(), 96, 150);
  x.fillStyle = "#ffffff"; x.font = '400 112px "Instrument Serif", Georgia, "Times New Roman", serif';
  let y = 290; for (const l of wrap(x, spec.title, W - 192 - 240)) { x.fillText(l, 96, y); y += 118; }
  y += 40;
  if (spec.stats?.length) {
    const cw = (W - 192) / spec.stats.length;
    spec.stats.forEach((s, i) => { x.fillStyle = "#ffffff"; x.font = '500 84px "IBM Plex Mono", ui-monospace, monospace'; x.fillText(s.value, 96 + i * cw, y + 70); x.fillStyle = "#a4aec6"; x.font = '500 26px "IBM Plex Mono", ui-monospace, monospace'; x.fillText(s.label.toUpperCase(), 96 + i * cw, y + 116); });
    y += 250;
  }
  for (const l of spec.lines.slice(0, 5)) {
    x.font = '400 30px Inter, system-ui, sans-serif';
    const sub = l.sub ? wrap(x, l.sub, W - 256).slice(0, 3) : []; const h = 96 + sub.length * 42;
    if (y + h > H - 150) break;
    x.fillStyle = "rgba(12,29,71,.85)"; x.beginPath(); x.roundRect(96, y - 62, W - 192, h, 26); x.fill();
    x.strokeStyle = "rgba(43,79,168,.9)"; x.lineWidth = 2; x.stroke();
    x.fillStyle = "#ffffff"; x.font = '400 58px "Instrument Serif", Georgia, serif'; x.fillText(l.text.slice(0, 28), 128, y + 4);
    x.fillStyle = "#a4aec6"; x.font = '400 30px Inter, system-ui, sans-serif';
    sub.forEach((t, i) => x.fillText(i === 2 && l.sub && wrap(x, l.sub, W - 256).length > 3 ? t.replace(/\s*\S*$/, "") + "…" : t, 128, y + 52 + i * 42));
    y += h + 26;
  }
  x.fillStyle = "#a4aec6"; x.font = '500 30px "IBM Plex Mono", ui-monospace, monospace'; x.fillText(spec.footer, 96, H - 96);
  return await new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error("no image"))), "image/png"));
}

/** Share through the phone/browser share sheet when it can carry a file, otherwise save the image. Returns what happened. */
export async function shareOrSave(blob: Blob, filename: string, text: string): Promise<"shared" | "saved" | "cancelled"> {
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) { try { await nav.share({ files: [file], text }); return "shared"; } catch (e) { if ((e as Error).name === "AbortError") return "cancelled"; } }
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "saved";
}
