"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { track } from "@/lib/metrics";
import { capture, normalizeQuery, safeLookup, type Sense } from "@core";
import { WebDictionary } from "@/lib/senses";
import { useStore } from "@/lib/store";
import { Btn, Card, Field, LinkBtn } from "@/components/ui";
import { Orb } from "@/components/Companion";
import { SensePicker } from "@/components/SensePicker";

const provider = new WebDictionary();

export default function Capture() {
  const { state, update, now } = useStore();
  const router = useRouter();
  const [word, setWord] = useState(""); const [context, setContext] = useState("");
  const [msg, setMsg] = useState<{ tone?: "good" | "warn"; text: string } | null>(null);
  const [choices, setChoices] = useState<Sense[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string> | undefined>();
  const [suggest, setSuggest] = useState<string[]>([]);
  const [hint, setHint] = useState<number | null>(null);
  const { isSignedIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const lang = state.prefs.explainLang;

  const save = async (senseId?: string, wordArg?: string, src = "Typed") => {
    if (busy) return; setBusy(true);
    const w = wordArg ?? word;
    try {
      setSuggest([]);
      const result = await safeLookup(provider, w, 8000);
      // Only the KIND of outcome is counted (never the word), so we can see which inputs fail.
      if (result.status === "found") track("lookup", result.note ? "found-form" : "found");
      else if (result.status === "unknown") track("lookup", result.suggestions?.length ? "unknown-suggested" : result.hint ? "acronym" : "unknown");
      else if (result.status === "pending" && result.kind) track("lookup", (result.kind as string) === "ok" ? "unknown" : result.kind);
      // Something that cannot be looked up (numbers, a URL, a sentence, another script): say why, and do not save it as a word.
      if (result.status === "pending" && result.reason === "invalid-input") { setMsg({ tone: "warn", text: result.message ?? "Please type one English word." }); setChoices(null); return; }
      // Unknown but close to real words: offer the spellings, never pick one silently.
      if (result.status === "unknown" && result.suggestions?.length) {
        setChoices(null); setSuggest(result.suggestions);
        setMsg({ text: `We do not have “${result.query}”. Did you mean one of these?${result.hint ? " " + result.hint : ""}` }); return;
      }
      const r = capture(state, result, { context, source: src, senseId, now: now() });
      if (r.outcome === "needs-sense" && result.status === "found") { setChoices(result.senses); setNotes(result.notes); setHint(null);
        // If they typed the sentence they heard it in, suggest the meaning that fits it (they still choose).
        if (isSignedIn && context.trim().length >= 8) {
          fetch("/api/sense-hint", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ word: result.senses[0].lemma, sentence: context.trim(), meanings: result.senses.map(x => x.definition) }) })
            .then(r => r.ok ? r.json() : null).then((j: { index?: number | null } | null) => { if (j && typeof j.index === "number") setHint(j.index); }).catch(() => undefined);
        } setMsg({ text: `${result.note ? result.note + " " : ""}This word has more than one meaning. Which one did you mean?` }); return; }
      if (r.state !== state) update(() => r.state);
      setChoices(null);
      if (r.outcome === "saved" && result.status === "found") { router.push(`/learn/${encodeURIComponent(senseId ?? result.senses[0].senseId)}${result.notes && (senseId ?? result.senses[0].senseId) in result.notes ? `?via=${encodeURIComponent(normalizeQuery(w))}` : ""}`); return; }
      const q = normalizeQuery(w);
      setMsg(r.outcome === "duplicate" ? { text: "You already saved this word." }
        : r.outcome === "unknown" ? { tone: "warn", text: `We do not have "${q}" in our word list yet. It is saved as pending. Nothing has been made up about it.` }
        : { tone: "warn", text: `We could not check "${q}" right now. It is saved as pending. We will not guess its meaning.` });
    } finally { setBusy(false); }
  };

  // The browser extension links here with ?word=... so the lookup starts by itself.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reading the URL on load is syncing with an external source */
    const q = new URLSearchParams(window.location.search).get("word");
    if (q) { setWord(q.slice(0, 48)); void save(undefined, q.slice(0, 48), "Extension"); }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on load
  }, []);

  return (
    <div className="stack">
      <h1>Save a word</h1>
      <Orb state={busy ? "searching" : "weaving"} size={112} label={busy ? "Looking up your word" : "Ready to save a word"} />
      <label className="sub" htmlFor="w">Type a word you heard or read.</label>
      <Field>
      <input id="w" placeholder="for example: euphemism" value={word} maxLength={120} autoCapitalize="none" autoCorrect="off" spellCheck={false}
        onChange={e => { setWord(e.target.value); setChoices(null); setMsg(null); setSuggest([]); }} />
      </Field>
      <label className="sub" htmlFor="c">Where did you hear it? (optional, private to you)</label>
      <Field>
      <textarea id="c" rows={3} placeholder="e.g. my boss said it at work" value={context} maxLength={500} onChange={e => setContext(e.target.value)} />
      </Field>
      <Btn onClick={() => save()} disabled={!word.trim() || busy}>{busy ? "Looking up…" : "Save word"}</Btn>
      <p className="sub small">Speaking a word is not available yet.</p>
      {msg && <Card tone={msg.tone}><span role="status">{msg.text}</span></Card>}
      {suggest.length > 0 && <div className="chips" role="group" aria-label="Did you mean">{suggest.map(sg => <button key={sg} className="chip" onClick={() => { setWord(sg); void save(undefined, sg); }}>{sg}</button>)}</div>}
      {choices && <SensePicker senses={choices} lang={lang} notes={notes} suggested={hint} onPick={s => save(s.senseId)} />}
      <LinkBtn href="/" kind="ghost">Back</LinkBtn>
    </div>
  );
}
