import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cleanInput } from "@core";
import { dbConfigured, getCoach, lookupDict } from "@/lib/db";
import { COACH_PROMPT_VERSION } from "@core";
import { Card, LinkBtn } from "@/components/ui";
import { Orb } from "@/components/Companion";
import { CoachSection } from "@/components/CoachSection";

// A public page per word: what people find when they search "<word> meaning". Real dictionary data only (no invented content),
// with the checked coach examples when they exist. Cached for a day.
export const revalidate = 3600;

async function load(raw: string) {
  const q = cleanInput(decodeURIComponent(raw)).query;
  if (!q || !dbConfigured()) return null;
  const hit = await lookupDict(q);
  return hit ? { q, hit } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ word: string }> }): Promise<Metadata> {
  const d = await load((await params).word);
  if (!d) return { title: "Word not found", robots: { index: false } };
  const s = d.hit.senses[0];
  return { title: `${s.lemma} meaning in simple words`, description: `${s.lemma} (${s.pos}): ${s.simple}`.slice(0, 200), alternates: { canonical: `/word/${encodeURIComponent(s.lemma)}` } };
}

export default async function WordPage({ params }: { params: Promise<{ word: string }> }) {
  const d = await load((await params).word);
  if (!d) notFound();
  const { hit } = d; const first = hit.senses[0];
  const coach = first.senseId.includes("%") ? await getCoach(first.senseId, COACH_PROMPT_VERSION).catch(() => null) : null;
  return (
    <div className="stack">
      <Orb size={96} label={`${first.lemma}`} />
      <h1 style={{ textAlign: "center" }}>{first.lemma}</h1>
      {hit.note && <p className="sub" style={{ textAlign: "center" }}>{hit.note}</p>}
      {first.pronunciation.text && <p className="sub" style={{ textAlign: "center" }}>say it: {first.pronunciation.text}</p>}
      {hit.senses.slice(0, 4).map(s => (
        <Card key={s.senseId}>
          <p className="label" style={{ margin: "0 0 6px" }}>{s.lemma !== first.lemma ? `${s.lemma} · ` : ""}{s.pos}</p>
          <h2 style={{ marginBottom: 6 }}>{s.simple}</h2>
          {s.simple !== s.definition && <p className="sub small">{s.definition}</p>}
          {s.explanations.hi && <p lang="hi">{s.explanations.hi} <span className="sub small">(unreviewed draft)</span></p>}
          {s.examples[0] && <p className="sub">&ldquo;{s.examples[0].text}&rdquo;</p>}
          {s.nearSynonyms.length > 0 && <p className="sub small">Similar: {s.nearSynonyms.slice(0, 6).map(n => n.lemma).join(", ")}</p>}
        </Card>
      ))}
      {coach && (
        <Card tone="good">
          <p className="label" style={{ margin: "0 0 8px" }}>How to use it</p>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>{coach.examples.map(e => <li key={e.intent}>{e.sentence}</li>)}</ul>
          {coach.memoryHook && <p className="sub" style={{ marginBottom: 0 }}>Memory trick: {coach.memoryHook}</p>}
          <p className="sub small">Drafted by AI and checked by a second AI. Not reviewed by an editor.</p>
        </Card>
      )}
      {!coach && first.senseId.includes("%") && <CoachSection senseId={first.senseId} lemma={first.lemma} auto />}
      <LinkBtn href={`/capture?word=${encodeURIComponent(first.lemma)}`}>Save &ldquo;{first.lemma}&rdquo; to my Wordwild</LinkBtn>
      <LinkBtn href="/" kind="ghost">Open Wordwild</LinkBtn>
      <p className="sub small">Meanings from Open English WordNet 2025 (CC BY 4.0) and CMU Pronouncing Dictionary.</p>
    </div>
  );
}
