"use client";
import { cleanOcrWord } from "@core";

export interface ScanWord { text: string; clean: string; conf: number; x0: number; y0: number; x1: number; y1: number; line: number }
export interface ScanResult { url: string; width: number; height: number; words: ScanWord[]; lines: string[] }
type Progress = (label: string, pct: number) => void;

// One recogniser is reused, so only the first photo pays the start-up cost. Files are served by this app: nothing leaves the device.
let workerP: Promise<import("tesseract.js").Worker> | null = null; let listener: Progress | null = null;
async function getWorker() {
  workerP ??= import("tesseract.js").then(({ createWorker }) => createWorker("eng", 1, {
    workerPath: "/ocr/worker.min.js", corePath: "/ocr", langPath: "/ocr/lang",
    logger: m => listener?.(m.status === "recognizing text" ? "Reading the page" : "Getting ready", Math.round((m.progress ?? 0) * 100)),
  })).catch(e => { workerP = null; throw e; });
  return workerP;
}

/** Shrinks a big phone photo (they are often 12 megapixels) so recognition is fast, and applies the camera's rotation. */
async function toCanvas(file: Blob, maxSide = 1800): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const g = c.getContext("2d")!; g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
  return c;
}

export async function scanImage(file: Blob, onProgress?: Progress): Promise<ScanResult> {
  onProgress?.("Getting ready", 0);
  const canvas = await toCanvas(file);
  listener = onProgress ?? null;
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(canvas, {}, { blocks: true });
    const words: ScanWord[] = []; const lines: string[] = []; let li = 0;
    for (const b of data.blocks ?? []) for (const p of b.paragraphs ?? []) for (const l of p.lines ?? []) {
      lines.push((l.text ?? "").replace(/\n/g, " ").trim());
      for (const w of l.words ?? []) {
        const clean = cleanOcrWord(w.text); if (!clean) continue;
        words.push({ text: w.text, clean, conf: w.confidence ?? 0, x0: w.bbox.x0 / canvas.width, y0: w.bbox.y0 / canvas.height, x1: w.bbox.x1 / canvas.width, y1: w.bbox.y1 / canvas.height, line: li });
      }
      li++;
    }
    return { url: canvas.toDataURL("image/jpeg", 0.85), width: canvas.width, height: canvas.height, words, lines };
  } finally { listener = null; }
}
