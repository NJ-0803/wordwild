// Loads ../dictionary/build/wikt-senses.jsonl (made by dictionary/wikt-filter.py) into ww_dict with source = 'wiktionary'.
// Additive and idempotent: never touches WordNet rows. Stops before the database gets too big (MAX_DB_MB, default 380).
//   node --no-warnings --env-file=.env.local scripts/wikt-load.mjs
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const sql = neon(process.env.DATABASE_URL);
const MAX = Number(process.env.MAX_DB_MB ?? 380) * 1024 * 1024;
const rows = readFileSync(new URL("../../dictionary/build/wikt-senses.jsonl", import.meta.url), "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));
const size = async () => Number((await sql`select pg_database_size(current_database()) as b`)[0].b);
console.log(`Loading ${rows.length} Wiktionary meanings. Database now ${(await size() / 1048576).toFixed(0)} MB, limit ${MAX / 1048576} MB`);
const CHUNK = 1500; let n = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  if (i % (CHUNK * 10) === 0 && (await size()) > MAX) { console.log(`Stopped at ${n} rows: database reached the size limit.`); break; }
  const part = JSON.stringify(rows.slice(i, i + CHUNK));
  await sql`insert into ww_dict (sense_id, lemma, pos, rank, synset_id, definition, examples, synonyms, antonyms, broader, ipa, arpabet, source)
    select x.sense_id, x.lemma, x.pos, x.rank, x.synset_id, x.definition, x.examples, x.synonyms, x.antonyms, x.broader, x.ipa, x.arpabet, 'wiktionary'
    from jsonb_to_recordset(${part}::jsonb) as x(sense_id text, lemma text, pos text, rank int, synset_id text, definition text, examples jsonb, synonyms jsonb, antonyms jsonb, broader jsonb, ipa text, arpabet text)
    on conflict (sense_id) do nothing`;
  n += Math.min(CHUNK, rows.length - i);
  if ((i / CHUNK) % 10 === 0) console.log(`  ${n}/${rows.length}`);
}
const [{ c }] = await sql`select count(*)::int as c from ww_dict where source = 'wiktionary'`;
const [{ l }] = await sql`select count(distinct lemma)::int as l from ww_dict`;
console.log(`done: ${c} Wiktionary meanings; ${l} entries in total; database ${(await size() / 1048576).toFixed(0)} MB`);
