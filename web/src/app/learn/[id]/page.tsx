"use client";
import { Icon } from "@/components/Icons";
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
  const [tab, setTab] = useState<"use" | "deep" | "related" | "examples" | "about">("use");
  /* eslint-disable react-hooks/set-state-in-effect -- reading the URL on load is syncing with an external source */
  useEffect(() => { setVia(new URLSearchParams(window.location.search).get("via")?.slice(0, 48) ?? null); }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  const tier = tierOf(s);
  const lang = state.prefs.explainLang; const hi = s.explanations.hi;
  const isSimple = simple ?? state.prefs.simpleMode;
  const text = isSimple ? s.simple : s.definition;
  const canSimplify = s.simple !== s.definition;
  const status = ({ "fixture-unreviewed": "sample content, not checked against a dictionary", "dictionary-source": "meaning from Open English WordNet, not reviewed by an editor", "ai-enriched-unreviewed": "meaning from WordNet, extra help drafted by AI and not reviewed by an editor" } as Record<string, string>)[s.provenance.status] ?? s.provenance.status;
  const TABS: [typeof tab, string][] = [["use", "Use it"], ["deep", "Go deeper"], ["related", "Related words"], ["examples", "Examples"], ["about", "Garden & source"]];
  const practice = tier === "dictionary" ? (
    <Card tone="warn">
      <b>Practice for this word is not ready yet.</b>
      <p className="sub small">We only show practice questions after they pass a check. Preparing them takes about half a minute.</p>
      {isSignedIn
        ? <Btn onClick={prepare} disabled={busy}>{busy ? "Preparing… please wait" : "Prepare practice for this word"}</Btn>
        : <LinkBtn href="/sign-in" kind="soft">Sign in to prepare practice</LinkBtn>}
      {busy && <ThinkingWait />}
      {err && <p role="alert"><b>{err}</b></p>}
    </Card>
  ) : <LinkBtn href={`/practice/${encodeURIComponent(s.senseId)}`}>Practise this word</LinkBtn>;
  return (
    <div className="grid g12">
      <div className="c5 stack">
        {via && via !== s.lemma && <Card tone="good"><span role="status">You looked up “{via}”. This is the dictionary form: <b>{s.lemma}</b>.</span></Card>}
        <div className="hero">
          <div style={{ flex: "0 0 auto" }}><WordBuddy lemma={s.lemma} mastery={lvl} due={due} size={84} /></div>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0 }}>{s.lemma}</h1>
            <p className="sub" style={{ margin: 0 }}>{s.pos}{s.pronunciation.text && <> · say it: {s.pronunciation.text}</>}</p>
          </div>
          <div style={{ flex: "0 0 auto" }}><SpeakingOrb size={64} /></div>
        </div>
        <Card><p className="meaning-text">{text}</p>
          {lang === "hi" && !hi && <p className="sub small" style={{ margin: "0 0 8px" }}>A Hindi explanation for this word is not available yet.</p>}
          <div className="row"><Btn icon={<Icon.Speaker />} onClick={() => say(`${s.lemma}. ${text}`)}>Listen</Btn>{canSimplify && <Btn kind="soft" onClick={() => setSimple(!isSimple)}>{isSimple ? "Fuller meaning" : "Explain simply"}</Btn>}</div>
        </Card>
        {lang === "hi" && hi && <Card><p lang="hi">{hi}</p><p className="sub small">Hindi text is an unreviewed draft.</p>
          <Btn kind="soft" icon={<Icon.Speaker />} onClick={() => say(hi, "hi")}>सुनिए</Btn>
          {!hasVoice("hi") && <p className="sub small">This device may not have a Hindi voice; the text is above.</p>}</Card>}
        {practice}
        <ShareButton filename={`${s.lemma}.png`} text={`${s.lemma}: ${s.simple}`} label="Share this word as a card" spec={() => ({ kicker: `Word · ${s.pos}`, title: s.lemma, lines: [{ text: "Meaning", sub: s.simple }, ...(s.examples[0] ? [{ text: "Example", sub: s.examples[0].text }] : [])], footer: "wordwild-seven.vercel.app" })} />
        <LinkBtn href="/" kind="ghost">Back</LinkBtn>
      </div>
      <div className="c7 stack">
        <div className="chips" role="group" aria-label="Sections of this word">
          {TABS.map(([k, label]) => <button key={k} className="chip" aria-pressed={tab === k} onClick={() => setTab(k)} style={{ minHeight: 50, fontSize: "1.05rem" }}>{label}</button>)}
        </div>
        {tab === "use" && <CoachSection senseId={s.senseId} lemma={s.lemma} />}
        {tab === "deep" && <DepthSection senseId={s.senseId} lemma={s.lemma} />}
        {tab === "related" && (<>
          <ConstellationSection senseId={s.senseId} lemma={s.lemma} />
          {s.nearSynonyms.length > 0 && <>
            <h2>{s.nearSynonyms.some(n => n.distinction) ? "Similar, but not the same" : "Words with a similar meaning"}</h2>
            {s.nearSynonyms.some(n => n.distinction)
              ? s.nearSynonyms.map(n => <Card key={n.lemma}><b>{n.lemma}</b>{n.distinction && <>: {n.distinction}</>}</Card>)
              : <Card>{s.nearSynonyms.map(n => n.lemma).join(", ")}<p className="sub small" style={{ margin: "6px 0 0" }}>These are listed as similar. They are not always interchangeable.</p></Card>}</>}
          {s.antonyms.length > 0 && <><h2>Opposite</h2><Card>{s.antonyms.join(", ")}</Card></>}
        </>)}
        {tab === "examples" && (<>
          {s.examples.length > 0 ? <>{s.examples.map((e, i) => <Card key={i}><SentenceHover text={e.text} skip={[s.lemma]}><p className="sentence">{e.text}</p></SentenceHover><Btn kind="soft" icon={<Icon.Speaker />} onClick={() => say(e.text)}>Listen</Btn></Card>)}</> : <Card><span className="sub">This dictionary has no example sentence for this meaning. Open <b>Use it</b> for examples written for a job interview, an essay, everyday talk and a story.</span></Card>}
          {s.suitableSituations.length > 0 && <><h2>When to use it</h2><Card tone="good">{s.suitableSituations.join(" ")}</Card></>}
          {s.unsuitableUses.length > 0 && <><h2>Careful</h2><Card tone="warn">{s.unsuitableUses.join(" ")}</Card></>}
        </>)}
        {tab === "about" && (<>
          <Card>
            <h2 style={{ fontSize: "1.15rem" }}>Why a garden?</h2>
            <p className="sub" style={{ margin: 0 }}>Every word you save is a plant that shows how well you know it. It grows only when you really use the word, so a tall plant means a word you can count on. Secure words also bring coins and XP to your town.</p>
          </Card>
          <WordScene stage={stage} label={s.lemma} summary={`${s.lemma} is ${lvl === "new" ? "a new seed" : lvl === "secure" ? "fully grown" : "growing"} in your garden.`} />
          <ol className="grow-steps" aria-label="How this word grows">
            {(["Seed: saved", "Sprout: practised once", "Growing: used in different ways", "Secure: yours to keep"] as const).map((t, i) => <li key={t} className={i < stage ? "done" : i === stage ? "now" : ""}><span aria-hidden>{i < stage ? <Icon.Check /> : i + 1}</span>{t}</li>)}
          </ol>
          <p className="sub small">{stage >= 3 ? "This word is secure. It will come back for a gentle check now and then." : "Next: practise it, or use it in your own sentence, to help it grow."}</p>
          <Card><span className="sub small">Source: {s.provenance.source} · Status: {status}. <Link href="/about" style={{ color: "var(--navy-glow)", display: "inline-flex", alignItems: "center", minHeight: 44 }}>Credits and licences</Link></span></Card>
        </>)}
      </div>
    </div>
  );
}
