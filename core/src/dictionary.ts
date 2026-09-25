import type { Sense } from './types.ts';
import { SENSES } from './fixtures.ts';
import { validateSense } from './validate.ts';

export type LookupResult =
  | { status: 'found'; senses: Sense[]; source: string }
  | { status: 'unknown'; query: string }                       // provider answered: no entry
  | { status: 'pending'; query: string; reason: string };      // provider failed / content unverified

export interface DictionaryProvider {
  readonly name: string;
  lookup(query: string): Promise<Sense[] | null>;   // null = no entry; throw = unavailable
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
  const query = normalizeQuery(raw);
  if (!isValidQuery(query)) return { status: 'pending', query, reason: 'invalid-input' };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const senses = await Promise.race([
      provider.lookup(query),
      new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error('timeout')), timeoutMs); }),
    ]);
    if (!senses || senses.length === 0) return { status: 'unknown', query };
    const problems = senses.flatMap(validateSense);
    if (problems.length) return { status: 'pending', query, reason: 'unverified-content' };
    return { status: 'found', senses, source: provider.name };
  } catch (e) {
    return { status: 'pending', query, reason: (e as Error).message === 'timeout' ? 'provider-timeout' : 'provider-unavailable' };
  } finally { clearTimeout(timer); }
}
