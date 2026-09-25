import type { Sense } from './types.ts';
import { SENSES } from './fixtures.ts';
import { validateSense } from './validate.ts';
import { cleanInput } from './query.ts';

export type LookupResult =
  | { status: 'found'; senses: Sense[]; source: string; notes?: Record<string, string>; note?: string }   // notes: senseId -> why it is shown ("went" is a form of "go")
  | { status: 'unknown'; query: string; suggestions?: string[]; hint?: string }                            // provider answered: no entry; suggestions are offered, never applied
  | { status: 'pending'; query: string; reason: string; kind?: string; message?: string };                 // provider failed / content unverified / input cannot be looked up

export interface DictionaryProvider {
  readonly name: string;
  lookup(query: string): Promise<Sense[] | null>;   // null = no entry; throw = unavailable
  /** Optional extras about the last answer for this query: why senses are shown, and "did you mean" spellings. */
  meta?(query: string): { notes?: Record<string, string>; note?: string; suggestions?: string[]; hint?: string } | undefined;
}

export const normalizeQuery = (raw: string) => String(raw ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
export const isValidQuery = (q: string) => q.length > 0 && q.length <= 48 && /^[\p{L}]+(?:['’ -][\p{L}]+)*$/u.test(q);

/** Small explicit form table; there is no stemmer, so unknown inflections stay honestly unknown. */
const FORMS: Record<string, string> = { fired: 'fire', firing: 'fire', fires: 'fire', euphemisms: 'euphemism', understatements: 'understatement' };

export class FixtureProvider implements DictionaryProvider {
  readonly name = 'fixture';
  private senses: Sense[];
  constructor(senses: Sense[] = SENSES) { this.senses = senses; }
  async lookup(query: string): Promise<Sense[] | null> {
    const lemma = FORMS[query] ?? query;
    const found = this.senses.filter(s => s.lemma === lemma);
    return found.length ? found : null;
  }
}

/** Never throws. Content that fails validation or provider errors become an honest pending state. */
export async function safeLookup(provider: DictionaryProvider, raw: string, timeoutMs = 4000): Promise<LookupResult> {
  const cleaned = cleanInput(raw);
  const query = cleaned.query;
  if (!query) return { status: 'pending', query: normalizeQuery(raw), reason: 'invalid-input', kind: cleaned.kind, message: cleaned.message };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const senses = await Promise.race([
      provider.lookup(query),
      new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error('timeout')), timeoutMs); }),
    ]);
    const meta = provider.meta?.(query);
    if (!senses || senses.length === 0) return { status: 'unknown', query, suggestions: meta?.suggestions, hint: meta?.hint ?? cleaned.note };
    const problems = senses.flatMap(validateSense);
    if (problems.length) return { status: 'pending', query, reason: 'unverified-content' };
    return { status: 'found', senses, source: provider.name, notes: meta?.notes, note: meta?.note };
  } catch (e) {
    return { status: 'pending', query, reason: (e as Error).message === 'timeout' ? 'provider-timeout' : 'provider-unavailable' };
  } finally { clearTimeout(timer); }
}
