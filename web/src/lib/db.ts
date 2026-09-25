import { neon } from "@neondatabase/serverless";
import type { Attempt, Capture, Prefs, SyncEvents, TownEvent } from "@core";

let _sql: ReturnType<typeof neon> | null = null;
const db = () => (_sql ??= neon(process.env.DATABASE_URL!));
export const dbConfigured = () => !!process.env.DATABASE_URL;

type Row = Record<string, unknown>;

export interface Stored extends SyncEvents { prefs: Prefs | null; prefsUpdatedAt: number }

export async function loadAll(userId: string): Promise<Stored> {
  const sql = db();
  const [caps, atts, learner, town] = await Promise.all([
    sql`select query, sense_id, context, source, status, at from ww_captures where user_id = ${userId} order by at`,
    sql`select key, sense_id, activity_id, skill, correct, hints_used, error_type, at from ww_attempts where user_id = ${userId} order by at, key`,
    sql`select prefs, prefs_updated_at from ww_learners where user_id = ${userId}`,
    sql`select key, kind, ref, at from ww_town_events where user_id = ${userId} order by at, key`,
  ]);
  return {
    captures: (caps as Row[]).map(r => ({ query: r.query, senseId: r.sense_id, context: r.context, source: r.source, status: r.status, at: Number(r.at) })) as Capture[],
    attempts: (atts as Row[]).map(r => ({ key: r.key, senseId: r.sense_id, activityId: r.activity_id, skill: r.skill, correct: r.correct, hintsUsed: r.hints_used, errorType: r.error_type, at: Number(r.at) })) as Attempt[],
    town: (town as Row[]).map(r => ({ key: r.key, kind: r.kind, ref: r.ref, at: Number(r.at) })) as TownEvent[],
    prefs: ((learner as Row[])[0]?.prefs as Prefs | undefined) ?? null,
    prefsUpdatedAt: Number((learner as Row[])[0]?.prefs_updated_at ?? 0),
  };
}

/** Idempotent writes: duplicates are ignored, so client retries are always safe. All statements are parameterised. */
export async function saveEvents(userId: string, ev: SyncEvents, prefs: Prefs | null, prefsUpdatedAt: number) {
  const sql = db();
  await sql`insert into ww_learners (user_id) values (${userId}) on conflict do nothing`;
  if (ev.captures.length) {
    const rows = JSON.stringify(ev.captures.map(c => ({ cap_key: c.senseId ?? `pending:${c.query}`, query: c.query, sense_id: c.senseId, context: c.context, source: c.source, status: c.status, at: c.at })));
    await sql`insert into ww_captures (user_id, cap_key, query, sense_id, context, source, status, at)
      select ${userId}, x.cap_key, x.query, x.sense_id, x.context, x.source, x.status, x.at
      from jsonb_to_recordset(${rows}::jsonb) as x(cap_key text, query text, sense_id text, context text, source text, status text, at bigint)
      on conflict (user_id, cap_key) do nothing`;
  }
  if (ev.attempts.length) {
    const rows = JSON.stringify(ev.attempts.map(a => ({ key: a.key, sense_id: a.senseId, activity_id: a.activityId, skill: a.skill, correct: a.correct, hints_used: a.hintsUsed, error_type: a.errorType, at: a.at })));
    await sql`insert into ww_attempts (user_id, key, sense_id, activity_id, skill, correct, hints_used, error_type, at)
      select ${userId}, x.key, x.sense_id, x.activity_id, x.skill, x.correct, x.hints_used, x.error_type, x.at
      from jsonb_to_recordset(${rows}::jsonb) as x(key text, sense_id text, activity_id text, skill text, correct boolean, hints_used int, error_type text, at bigint)
      on conflict (user_id, key) do nothing`;
  }
  if (ev.town?.length) {
    const rows = JSON.stringify(ev.town.map(t => ({ key: t.key, kind: t.kind, ref: t.ref, at: t.at })));
    await sql`insert into ww_town_events (user_id, key, kind, ref, at)
      select ${userId}, x.key, x.kind, x.ref, x.at from jsonb_to_recordset(${rows}::jsonb) as x(key text, kind text, ref text, at bigint)
      on conflict (user_id, key) do nothing`;
  }
  if (prefs) {   // last write wins, decided by the client's own timestamp
    await sql`update ww_learners set prefs = ${JSON.stringify(prefs)}::jsonb, prefs_updated_at = ${prefsUpdatedAt}
      where user_id = ${userId} and prefs_updated_at < ${prefsUpdatedAt}`;
  }
}

export async function deleteAll(userId: string) {
  const sql = db();
  await sql`delete from ww_whatsapp where user_id = ${userId}`;          // phone numbers are personal data: gone with the account
  await sql`delete from ww_telegram where user_id = ${userId}`;
  await sql`delete from ww_town_events where user_id = ${userId}`;
  await sql`delete from ww_attempts where user_id = ${userId}`;
  await sql`delete from ww_captures where user_id = ${userId}`;
  await sql`delete from ww_learners where user_id = ${userId}`;
}

// ---- Dictionary (read-only reference data, shared by everyone) ----
import { candidateLemmas, rowToSense, type DictRow, type Sense } from "@core";

const dictCols = "sense_id, lemma, pos, rank, synset_id, definition, examples, synonyms, antonyms, broader, ipa, arpabet";
export async function lookupDict(word: string): Promise<{ senses: Sense[]; matched: string } | null> {
  const sql = db();
  for (const cand of candidateLemmas(word)) {
    const rows = (await sql.query(`select ${dictCols} from ww_dict where lemma = $1 order by case pos when 'n' then 1 when 'v' then 2 when 'adj' then 3 else 4 end, rank limit 12`, [cand])) as unknown as DictRow[];
    if (rows.length) return { senses: await withEnriched(rows.map(rowToSense)), matched: cand };
  }
  return null;
}
export async function getDictSense(id: string): Promise<Sense | null> {
  const rows = (await db().query(`select ${dictCols} from ww_dict where sense_id = $1`, [id])) as unknown as DictRow[];
  if (!rows[0]) return null;
  return (await getEnriched(id)) ?? rowToSense(rows[0]);
}
async function withEnriched(senses: Sense[]): Promise<Sense[]> {
  const rows = (await db().query(`select sense_id, content from ww_enriched where sense_id = any($1::text[])`, [senses.map(s => s.senseId)])) as unknown as { sense_id: string; content: Sense }[];
  const by = new Map(rows.map(r => [r.sense_id, r.content]));
  return senses.map(s => by.get(s.senseId) ?? s);
}
export async function dictIdsExist(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const rows = (await db().query(`select sense_id from ww_dict where sense_id = any($1::text[])`, [ids])) as unknown as { sense_id: string }[];
  return new Set(rows.map(r => r.sense_id));
}

// ---- Enrichment cache, failure memory, quota ----
export async function getEnriched(id: string): Promise<Sense | null> {
  const rows = (await db().query(`select content from ww_enriched where sense_id = $1`, [id])) as unknown as { content: Sense }[];
  return rows[0]?.content ?? null;
}
export async function putEnriched(id: string, sense: Sense, model: string, verifyModel: string, promptVersion: number) {
  await db().query(`insert into ww_enriched (sense_id, content, model, verify_model, prompt_version) values ($1, $2::jsonb, $3, $4, $5)
    on conflict (sense_id) do nothing`, [id, JSON.stringify(sense), model, verifyModel, promptVersion]);
  await db().query(`delete from ww_enrich_failed where sense_id = $1`, [id]);
}
export async function recentFailure(id: string, withinMinutes = 60): Promise<{ stage: string; problems: string[] } | null> {
  const rows = (await db().query(`select stage, problems from ww_enrich_failed where sense_id = $1 and at > now() - ($2 || ' minutes')::interval`, [id, String(withinMinutes)])) as unknown as { stage: string; problems: string[] }[];
  return rows[0] ?? null;
}
export async function putFailure(id: string, stage: string, problems: string[]) {
  await db().query(`insert into ww_enrich_failed (sense_id, stage, problems) values ($1, $2, $3::jsonb)
    on conflict (sense_id) do update set stage = excluded.stage, problems = excluded.problems, at = now()`, [id, stage, JSON.stringify(problems.slice(0, 8))]);
}
/** Atomically claims one generation for today; returns false when the learner is over quota. */
export async function claimQuota(userId: string, perDay: number): Promise<boolean> {
  const rows = (await db().query(`insert into ww_enrich_usage (user_id, day, n) values ($1, current_date, 1)
    on conflict (user_id, day) do update set n = ww_enrich_usage.n + 1 where ww_enrich_usage.n < $2 returning n`, [userId, perDay])) as unknown as { n: number }[];
  return rows.length > 0;
}

/** Give back a claimed generation when the failure was ours (rate limit, outage), not the learner's or the word's. */
export async function refundQuota(userId: string) {
  await db().query(`update ww_enrich_usage set n = greatest(n - 1, 0) where user_id = $1 and day = current_date`, [userId]);
}

// ---- Word Constellation ----
import type { Candidate, Role } from "@core";

export interface DictRel { sense_id: string; lemma: string; pos: string; definition: string }
const REL_COLS = "sense_id, lemma, pos, definition";

export async function getSenseFacts(senseId: string) {
  const r = (await db().query(`select synset_id, pos, lemma, antonyms, broader from ww_dict where sense_id = $1`, [senseId])) as unknown as { synset_id: string; pos: string; lemma: string; antonyms: string[]; broader: string[] }[];
  return r[0] ?? null;
}
export async function sameSynset(synsetId: string, lemma: string) {
  return (await db().query(`select ${REL_COLS} from ww_dict where synset_id = $1 and lemma <> $2`, [synsetId, lemma])) as unknown as DictRel[];
}
/** One sense per lemma (prefer the same part of speech, then WordNet's first sense). */
export async function firstSenses(lemmas: string[], pos: string) {
  if (!lemmas.length) return [] as DictRel[];
  return (await db().query(`select distinct on (lemma) ${REL_COLS} from ww_dict where lemma = any($1::text[]) order by lemma, (pos = $2) desc, rank`, [lemmas, pos])) as unknown as DictRel[];
}
/** Up to `per` meanings for each lemma, best-matching part of speech first, so the model can choose the intended one. */
export async function sensesFor(lemmas: string[], pos: string, per = 6) {
  if (!lemmas.length) return new Map<string, DictRel[]>();
  const rows = (await db().query(`select ${REL_COLS}, row_number() over (partition by lemma order by (pos = $2) desc, rank) as n from ww_dict where lemma = any($1::text[])`, [lemmas, pos])) as unknown as (DictRel & { n: number })[];
  const m = new Map<string, DictRel[]>();
  for (const r of rows) if (Number(r.n) <= per) m.set(r.lemma, [...(m.get(r.lemma) ?? []), r]);
  return m;
}
export async function siblings(broader: string[], lemma: string, pos: string) {
  if (!broader.length) return [] as DictRel[];
  return (await db().query(`select distinct on (lemma) ${REL_COLS} from ww_dict where broader ?| $1::text[] and lemma <> $2 and pos = $3 order by lemma, rank limit 12`, [broader, lemma, pos])) as unknown as DictRel[];
}
export async function senseCounts(lemmas: string[]) {
  if (!lemmas.length) return new Map<string, number>();
  const r = (await db().query(`select lemma, count(*)::int as n from ww_dict where lemma = any($1::text[]) group by lemma`, [lemmas])) as unknown as { lemma: string; n: number }[];
  return new Map(r.map(x => [x.lemma, x.n]));
}
export async function getLevels(lemmas: string[]) {
  if (!lemmas.length) return new Map<string, { level: number; topics: string[]; source: string }>();
  const r = (await db().query(`select lemma, level, topics, source from ww_word_level where lemma = any($1::text[])`, [lemmas])) as unknown as { lemma: string; level: number; topics: string[]; source: string }[];
  return new Map(r.map(x => [x.lemma, { level: Number(x.level), topics: x.topics, source: x.source }]));
}
export async function putLevels(items: { lemma: string; level: number; topics: string[] }[], model: string) {
  if (!items.length) return;
  await db().query(`insert into ww_word_level (lemma, level, topics, source, model)
    select x.lemma, x.level, x.topics, 'ai', $2 from jsonb_to_recordset($1::jsonb) as x(lemma text, level real, topics jsonb)
    on conflict (lemma) do update set level = excluded.level, topics = excluded.topics, source = 'ai', model = excluded.model, at = now()`, [JSON.stringify(items), model]);
}
export async function getPool(senseId: string, minVersion = 0): Promise<Candidate[] | null> {
  const r = (await db().query(`select pool from ww_constellation_pool where sense_id = $1 and prompt_version >= $2`, [senseId, minVersion])) as unknown as { pool: Candidate[] }[];
  return r[0]?.pool ?? null;
}
export async function putPool(senseId: string, pool: Candidate[], model: string, promptVersion: number) {
  await db().query(`insert into ww_constellation_pool (sense_id, pool, model, prompt_version) values ($1, $2::jsonb, $3, $4) on conflict (sense_id) do update set pool = excluded.pool, model = excluded.model, prompt_version = excluded.prompt_version, at = now() where ww_constellation_pool.prompt_version < excluded.prompt_version`, [senseId, JSON.stringify(pool), model, promptVersion]);
}
export type { Role };

// ---- Go deeper cache ----
import type { Depth } from "@core";
export async function getDepth(senseId: string, minVersion = 0): Promise<Depth | null> {
  const r = (await db().query(`select content from ww_depth where sense_id = $1 and prompt_version >= $2`, [senseId, minVersion])) as unknown as { content: Depth }[];
  return r[0]?.content ?? null;
}
export async function putDepth(senseId: string, d: Depth, model: string, v: number) {
  await db().query(`insert into ww_depth (sense_id, content, model, prompt_version) values ($1, $2::jsonb, $3, $4)
    on conflict (sense_id) do update set content = excluded.content, model = excluded.model, prompt_version = excluded.prompt_version, at = now() where ww_depth.prompt_version < excluded.prompt_version`, [senseId, JSON.stringify(d), model, v]);
}
export async function lemmaExists(lemma: string): Promise<boolean> {
  const r = (await db().query(`select 1 from ww_dict where lemma = $1 limit 1`, [lemma])) as unknown as unknown[];
  return r.length > 0;
}
