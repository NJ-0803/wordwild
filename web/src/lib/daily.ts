import { estimateLevel, masteryLevel, pickDaily, rebuildState, selectConstellation, SENSE_BY_ID, type DailyKind, type DailyText, type Sense } from "@core";
import { getDictSense, getLevels, getPool, loadAll } from "./db";

const senseFor = async (id: string): Promise<Sense | null> => SENSE_BY_ID[id] ?? (await getDictSense(id));

export interface DailyChoice { kind: DailyKind; senseId: string; w: DailyText; from?: string }

/**
 * The word to send this learner today, or null when there is nothing useful to say. Channel independent:
 * Telegram and WhatsApp both format this result their own way. Uses cached constellation pools only, so a background job never spends AI money.
 */
export async function chooseForUser(userId: string, now: number, tz: number): Promise<DailyChoice | null> {
  const stored = await loadAll(userId);
  const state = rebuildState(stored, stored.prefs ?? undefined);
  const recent = state.captures.filter(c => c.senseId && c.status === "resolved").sort((a, b) => b.at - a.at)[0];
  let candidates: { senseId: string; lemma: string; from: string }[] = [];
  if (recent?.senseId && recent.senseId.includes("%")) {
    const pool = await getPool(recent.senseId);
    const target = (await getLevels([recent.query])).get(recent.query);
    if (pool) {
      const practised = Object.values(state.senses).filter(r => ["practising", "secure"].includes(masteryLevel(r))).map(r => SENSE_BY_ID[r.senseId]?.difficulty).filter((d): d is 1 | 2 | 3 | 4 | 5 => !!d);
      const est = estimateLevel(state.prefs.profile, practised);
      const known = new Set(state.captures.map(c => c.query));
      candidates = selectConstellation({ target: { lemma: recent.query, level: target?.level ?? 3 }, learner: { level: est.level, interests: state.prefs.profile?.interests ?? [] }, candidates: pool, known })
        .map(p => ({ senseId: p.senseId, lemma: p.lemma, from: recent.query }));
    }
  }
  const pick = pickDaily(state, now, tz, candidates);
  if (pick.kind === "none" || !pick.senseId) return null;
  const s = await senseFor(pick.senseId); if (!s) return null;
  return { kind: pick.kind, senseId: pick.senseId, from: pick.from, w: { lemma: s.lemma, pos: s.pos, simple: s.simple, hindi: s.explanations.hi, example: s.examples[0]?.text } };
}
