// Loads ../dictionary/build/senses.json into ww_dict (idempotent: upserts). Run: npm run dict:load
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const sql = neon(process.env.DATABASE_URL);
const rows = JSON.parse(readFileSync(new URL("../../dictionary/build/senses.json", import.meta.url), "utf8"));
const [{ db }] = await sql`select current_database() as db`;
console.log(`Loading ${rows.length} senses into "${db}"`);
const CHUNK = 1500; let n = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const part = JSON.stringify(rows.slice(i, i + CHUNK));
  await sql`insert into ww_dict (sense_id, lemma, pos, rank, synset_id, definition, examples, synonyms, antonyms, broader, ipa, arpabet)
    select x.sense_id, x.lemma, x.pos, x.rank, x.synset_id, x.definition, x.examples, x.synonyms, x.antonyms, x.broader, x.ipa, x.arpabet
    from jsonb_to_recordset(${part}::jsonb) as x(sense_id text, lemma text, pos text, rank int, synset_id text, definition text, examples jsonb, synonyms jsonb, antonyms jsonb, broader jsonb, ipa text, arpabet text)
    on conflict (sense_id) do update set lemma = excluded.lemma, pos = excluded.pos, rank = excluded.rank, synset_id = excluded.synset_id,
      definition = excluded.definition, examples = excluded.examples, synonyms = excluded.synonyms, antonyms = excluded.antonyms,
      broader = excluded.broader, ipa = excluded.ipa, arpabet = excluded.arpabet`;
  n += Math.min(CHUNK, rows.length - i);
  if ((i / CHUNK) % 10 === 0) console.log(`  ${n}/${rows.length}`);
}
const [{ c }] = await sql`select count(*)::int as c from ww_dict`;
const [{ size }] = await sql`select pg_size_pretty(pg_total_relation_size('ww_dict')) as size`;
console.log(`done: ${c} rows in ww_dict, ${size}`);
