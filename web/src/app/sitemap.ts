import type { MetadataRoute } from "next";
import { neon } from "@neondatabase/serverless";
const base = process.env.APP_URL ?? "https://wordwild-seven.vercel.app";
export const revalidate = 86400;

/**
 * Only words that have checked extra content (verified help or coach) are listed: a page with nothing beyond the raw dictionary
 * line would be thin content. The list grows as words get enriched.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const home: MetadataRoute.Sitemap = [{ url: base, changeFrequency: "weekly", priority: 1 }];
  if (!process.env.DATABASE_URL) return home;
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = (await sql.query(`select distinct d.lemma from ww_dict d join (select sense_id from ww_coach union select sense_id from ww_enriched) e on e.sense_id = d.sense_id limit 5000`)) as unknown as { lemma: string }[];
    return [...home, ...rows.map(r => ({ url: `${base}/word/${encodeURIComponent(r.lemma)}`, changeFrequency: "monthly" as const, priority: 0.6 }))];
  } catch { return home; }
}
