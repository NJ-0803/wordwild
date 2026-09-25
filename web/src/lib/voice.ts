import { cleanInput, type Sense } from "@core";
import { lookupDict, suggestLemmas } from "./db";
import { senseFromContext, transcribeAudio, understandSpoken } from "./groq";

export type VoiceResult =
  | { status: "found"; transcript: string; word: string; senses: Sense[]; suggested: number | null; matched: string }
  | { status: "no-word"; transcript: string }
  | { status: "unknown"; transcript: string; word: string; suggestions?: string[] }
  | { status: "silent" };

/**
 * Speech -> transcript -> the word they mean -> dictionary. If they also said the sentence, the meaning is chosen from it.
 * Nothing is invented: a word that is not in the dictionary comes back as "unknown", and a vague request as "no-word".
 */
export async function answerVoice(bytes: ArrayBuffer, filename: string, mime: string): Promise<VoiceResult> {
  const transcript = await transcribeAudio(bytes, filename, mime);
  if (transcript.replace(/[^\p{L}]/gu, "").length < 2) return { status: "silent" };
  const { word, context } = await understandSpoken(transcript);
  const q = cleanInput(word).query;
  if (!q) return { status: "no-word", transcript };
  const hit = await lookupDict(q);
  if (!hit) return { status: "unknown", transcript, word: q, suggestions: await suggestLemmas(q) };
  let suggested: number | null = null;
  if (hit.senses.length > 1 && context) {
    try { const i = await senseFromContext(hit.matched, context, hit.senses.map(s => s.definition)); suggested = i >= 0 ? i : null; } catch { /* the learner can still choose */ }
  }
  return { status: "found", transcript, word: q, senses: hit.senses, suggested, matched: hit.matched };
}
