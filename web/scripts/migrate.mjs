// Usage: npm run db:migrate   (reads DATABASE_URL from .env.local via node --env-file)
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const sql = neon(process.env.DATABASE_URL);
const statements = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8")
  .split(/;\s*\n/).map(s => s.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean);
const [{ db }] = await sql`select current_database() as db`;
console.log(`Applying ${statements.length} statements to database "${db}"`);
for (const s of statements) await sql.query(s);
const t = await sql`select table_name from information_schema.tables where table_name like 'ww\\_%' order by 1`;
console.log("tables:", t.map(r => r.table_name).join(", "));
