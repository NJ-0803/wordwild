// LIVE: real speech files -> Whisper -> word extraction -> dictionary. Prints what the app would do.
import { readFileSync } from "node:fs";
import { answerVoice } from "../src/lib/voice.ts";
const files = ["en", "hi", "ctx", "vague", "unk"];
for (const f of files) {
  const buf = readFileSync(`/tmp/voice/${f}.wav`); const t0 = Date.now();
  const r = await answerVoice(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, `${f}.wav`, "audio/wav");
  const took = ((Date.now() - t0) / 1000).toFixed(1);
  if (r.status === "found") console.log(`${f.padEnd(6)} ${took}s  heard: "${r.transcript}"\n       word="${r.word}" -> ${r.senses.length} meanings; suggested=${r.suggested === null ? "none (learner chooses)" : r.suggested + ' "' + r.senses[r.suggested].definition.slice(0, 50) + '"'}`);
  else console.log(`${f.padEnd(6)} ${took}s  ${r.status}${"transcript" in r ? `  heard: "${r.transcript}"` : ""}${"word" in r ? `  word="${r.word}"` : ""}`);
}
