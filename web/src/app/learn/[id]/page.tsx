"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { masteryLevel, tierOf, type Sense } from "@core";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { useAuth } from "@clerk/nextjs";
import { enrichSense, safeDecode, useSense, type EnrichResult } from "@/lib/senses";
import { Btn, Card, LinkBtn } from "@/components/ui";
import { Loading, SpeakingOrb, ThinkingWait, WordBuddy } from "@/components/Companion";
import { WordScene } from "@/components/GardenScene";
import { ConstellationSection } from "@/components/ConstellationSection";
import { DepthSection } from "@/components/DepthSection";
import { CoachSection } from "@/components/CoachSection";
import { ShareButton } from "@/components/ShareButton";
import { SentenceHover } from "@/components/SentenceHover";
import { hasVoice, say } from "@/lib/speech";

export default function LearnPage() {
  const { id } = useParams<{ id: string }>(); const senseId = safeDecode(id);
  const sense = useSense(senseId);
  if (sense === undefined) return <Loading />;
  if (sense === null) return <Card tone="warn">We could not load this word. If you are offline, open it once while online and it will be saved on this device. <LinkBtn href="/" kind="ghost">Back</LinkBtn></Card>;
  return <Lesson base={sense} />;
}

const WHY: Record<Exclude<EnrichResult, { ok: true }>["reason"], string> = {
  signin: "Sign in to prepare practice for this word.",
  "not-configured": "Preparing practice is not switched on yet on this server.",
  busy: "The practice maker is busy right now. Nothing was used up. Please try again in a minute.",
  rejected: "We could not make good practice questions for this word, so we did not show any. You can still read its meaning.",
  quota: "You have reached today's limit for preparing new words. Try again tomorrow.",
  offline: "You seem to be offline. Try again when you are connected.",
  error: "Something went wrong. Please try again in a moment.",
};

function Lesson({ base }: { base: Sense }) {
  const { state, now } = useStore();
  const { isSignedIn } = useAuth();
  const [enriched, setEnriched] = useState<Sense | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const s = enriched ?? base;
  const rec = state.senses[s.senseId];
  const lvl = rec ? masteryLevel(rec) : "new";
  const stage = ({ new: 0, seen: 1, practising: 2, secure: 3 } as const)[lvl];
  const due = !!rec && rec.lastAttemptAt > 0 && rec.due <= now();
  const prepare = async () => {
    if (busy) return; setBusy(true); setErr(null);
    const r = await enrichSense(base.senseId);
    if (r.ok) setEnriched(r.sense); else setErr(WHY[r.reason]);
    setBusy(false);
  };
  const [simple, setSimple] = useState<boolean | null>(null);
  const [via, setVia] = useState<string | null>(null);
  /* eslint-disable react-hooks/set-state-in-effect -- reading the URL on load is syncing with an external source */
  useEffect(() => { setVia(new URLSearchParams(window.location.search).get("via")?.slice(0, 48) ?? null); }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  const tier = tierOf(s);
  const lang = state.prefs.explainLang; const hi = s.explanations.hi;
  const isSimple = simple ?? state.prefs.simpleMode;
  const text = isSimple ? s.simple : s.definition;
  const canSimplify = s.simple !== s.definition;
  const status = ({ "fixture-unreviewed": "sample content, not checked against a dictionary", "dictionary-source": "meaning from Open English WordNet, not reviewed by an editor", "ai-enriched-unreviewed": "meaning from WordNet, extra help drafted by AI and not reviewed by an editor" } as Record<string, string>)[s.provenance.status] ?? s.provenance.status;
  return (
    <div className="stack">
      {via && via !== s.lemma && <Card tone="good"><span role="status">You looked up “{via}”. This is the dictionary form: <b>{s.lemma}</b>.</span></Card>}
      <div className="hero">
        <div style={{ flex: "0 0 auto" }}><WordBuddy lemma={s.lemma} mastery={lvl} due={due} size={76} /></div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0 }}>{s.lemma}</h1>
          <p className="sub" style={{ margin: 0 }}>{s.pos}{s.pronunciation.text && <> · say it: {s.pronunciation.text}</>}</p>
        </div>
      </div>
      <WordScene stage={stage} label={s.lemma} summary={`${s.lemma} is ${lvl === "new" ? "a new seed" : lvl === "secure" ? "fully grown" : "growing"} in your garden.`} />
      <Btn icon="🔊" onClick={() => say(`${s.lemma}. ${text}`)}>Listen</Btn>
      <SpeakingOrb />
      <Card><h2>{text}</h2>
        {canSimplify && <Btn kind="soft" onClick={() => setSimple(!isSimple)}>{isSimple ? "Show fuller meaning" : "Explain more simply"}</Btn>}</Card>
      {lang === "hi" && hi && <Card><p lang="hi">{hi}</p><p className="sub small">Hindi text is an unreviewed draft.</p>
        <Btn kind="soft" icon="🔊" onClick={() => say(hi, "hi")}>सुनिए</Btn>
        {!hasVoice("hi") && <p className="sub small">This device may not have a Hindi voice; the text is above.</p>}</Card>}
      {lang === "hi" && !hi && <Card><span className="sub small">A Hindi explanation for this word is not available yet.</span></Card>}
      <ShareButton filename={`${s.lemma}.png`} text={`${s.lemma}: ${s.simple}`} label="Share this word as a card" spec={() => ({ kicker: `Word · ${s.pos}`, title: s.lemma, lines: [{ text: "Meaning", sub: s.simple }, ...(s.examples[0] ? [{ text: "Example", sub: s.examples[0].text }] : [])], footer: "wordwild-seven.vercel.app" })} />
      <CoachSection senseId={s.senseId} lemma={s.lemma} />
      <DepthSection senseId={s.senseId} lemma={s.lemma} />
      <ConstellationSection senseId={s.senseId} lemma={s.lemma} />
      {s.examples.length > 0 && <><h2>Examples</h2>{s.examples.map((e, i) => <Card key={i}><SentenceHover text={e.text} skip={[s.lemma]}><p>{e.text}</p></SentenceHover><Btn kind="soft" icon="🔊" onClick={() => say(e.text)}>Listen</Btn></Card>)}</>}
      {s.suitableSituations.length > 0 && <><h2>When to use it</h2><Card tone="good">{s.suitableSituations.join(" ")}</Card></>}
      {s.unsuitableUses.length > 0 && <><h2>Careful</h2><Card tone="warn">{s.unsuitableUses.join(" ")}</Card></>}
      {s.nearSynonyms.length > 0 && <>
        <h2>{s.nearSynonyms.some(n => n.distinction) ? "Similar, but not the same" : "Words with a similar meaning"}</h2>
        {s.nearSynonyms.some(n => n.distinction)
          ? s.nearSynonyms.map(n => <Card key={n.lemma}><b>{n.lemma}</b>{n.distinction && <>: {n.distinction}</>}</Card>)
          : <Card>{s.nearSynonyms.map(n => n.lemma).join(", ")}<p className="sub small" style={{ margin: "6px 0 0" }}>These are listed as similar. They are not always interchangeable.</p></Card>}</>}
      {s.antonyms.length > 0 && <><h2>Opposite</h2><Card>{s.antonyms.join(", ")}</Card></>}
      <Card><span className="sub small">Source: {s.provenance.source} · Status: {status}. <Link href="/about" style={{ color: "var(--brand)", display: "inline-flex", alignItems: "center", minHeight: 44 }}>Credits and licences</Link></span></Card>
      {tier === "dictionary" ? (
        <Card tone="warn">
          <b>Practice for this word is not ready yet.</b>
          <p className="sub small">We only show practice questions after they pass a check. Preparing them takes about half a minute.</p>
          {isSignedIn
            ? <Btn onClick={prepare} disabled={busy}>{busy ? "Preparing… please wait" : "Prepare practice for this word"}</Btn>
            : <LinkBtn href="/sign-in" kind="soft">Sign in to prepare practice</LinkBtn>}
          {busy && <ThinkingWait />}
          {err && <p role="alert"><b>{err}</b></p>}
        </Card>
      ) : <LinkBtn href={`/practice/${encodeURIComponent(s.senseId)}`}>Practise this word</LinkBtn>}
      <LinkBtn href="/" kind="ghost">Back</LinkBtn>
    </div>
  );
}
