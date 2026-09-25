import { neon } from "@neondatabase/serverless";
let _s: ReturnType<typeof neon> | null = null;
/** Shared Neon client for modules outside db.ts. */
export const sql = () => (_s ??= neon(process.env.DATABASE_URL!));
