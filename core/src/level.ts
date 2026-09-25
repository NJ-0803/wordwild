import type { Prefs } from './types.ts';

/**
 * Learner level model. Everything here is optional and explainable.
 * Principles (from the brief): never infer ability from the hardest word searched; never treat age or schooling as ability;
 * ask politely and let people skip; let real evidence outweigh what they told us as it accumulates.
 */
export type ReadingComfort = 1 | 2 | 3 | 4;
export type AgeBand = 'under13' | '13-17' | '18-29' | '30-49' | '50+';
export type Schooling = 'none-little' | 'school' | 'college' | 'advanced';
export type Purpose = 'work' | 'study' | 'reading' | 'movies' | 'daily' | 'exam';

export interface LearnerProfile {
  readingComfort?: ReadingComfort;   // "How do you usually read English?" (the main signal)
  interests: string[];               // topics they like, from a fixed list
  purpose?: Purpose;
  ageBand?: AgeBand;                 // only tunes tone, never level
  schooling?: Schooling;             // only a weak prior when readingComfort is unknown
  updatedAt: number;
}

export const INTERESTS = ['cricket', 'cooking', 'movies', 'music', 'farming', 'business', 'health', 'technology', 'family', 'religion', 'travel', 'news', 'nature', 'money'] as const;

export const COMFORT_PROMPTS: { value: ReadingComfort; label: string }[] = [
  { value: 1, label: 'I am just starting to read English' },
  { value: 2, label: 'I can read simple messages and signs' },
  { value: 3, label: 'I read news, stories or work emails' },
  { value: 4, label: 'I read long, technical or academic texts' },
];

const COMFORT_PRIOR: Record<ReadingComfort, number> = { 1: 1.3, 2: 2.1, 3: 3.1, 4: 4.0 };
const SCHOOLING_PRIOR: Record<Schooling, number> = { 'none-little': 1.5, school: 2.4, college: 3.2, advanced: 3.8 };
const clamp = (x: number, lo = 1, hi = 5) => Math.min(hi, Math.max(lo, x));

export interface LevelEstimate { level: number; certainty: 'low' | 'medium' | 'high'; tone: 'adult' | 'child-friendly'; factors: string[] }

/** `practisedLevels` = difficulty (1-5) of words the learner has genuinely succeeded with (practising or secure), NOT words they looked up. */
export function estimateLevel(profile: LearnerProfile | undefined, practisedLevels: number[]): LevelEstimate {
  const factors: string[] = [];
  let prior = 2.0; let known = false;
  if (profile?.readingComfort) { prior = COMFORT_PRIOR[profile.readingComfort]; known = true; factors.push(`You told us how you read English (level ${prior.toFixed(1)}).`); }
  else if (profile?.schooling) { prior = SCHOOLING_PRIOR[profile.schooling]; factors.push('We used how far you studied as a gentle starting point.'); }
  else factors.push('We started at a friendly middle-low level, because we do not know you yet.');

  const n = practisedLevels.length;
  let level = prior;
  if (n > 0) {
    const sorted = [...practisedLevels].sort((a, b) => a - b);
    const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    const w = Math.min(0.75, n * 0.09);                 // evidence counts more with every word actually learned
    level = (1 - w) * prior + w * median;
    factors.push(`Words you have practised (${n}) moved your level to ${level.toFixed(1)}.`);
  }
  const certainty = n >= 6 ? 'high' : known || n >= 2 ? 'medium' : 'low';
  const tone = profile?.ageBand === 'under13' || profile?.ageBand === '13-17' ? 'child-friendly' : 'adult';
  return { level: clamp(level), certainty, tone, factors };
}

/** Word-level labels used in the UI. Words are not "hard" or "easy" in themselves; they are compared with the reader. */
export const relativeLabel = (wordLevel: number, learnerLevel: number) =>
  wordLevel < learnerLevel - 0.5 ? 'an easier word' : wordLevel <= learnerLevel + 0.7 ? 'at your level' : 'a small stretch';

export function sanitizeProfile(raw: unknown): LearnerProfile | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const comfort = [1, 2, 3, 4].includes(r.readingComfort as number) ? (r.readingComfort as ReadingComfort) : undefined;
  const interests = Array.isArray(r.interests) ? (r.interests as unknown[]).filter((x): x is string => typeof x === 'string' && (INTERESTS as readonly string[]).includes(x)).slice(0, 6) : [];
  const purposes = ['work', 'study', 'reading', 'movies', 'daily', 'exam'];
  const ages = ['under13', '13-17', '18-29', '30-49', '50+']; const schools = ['none-little', 'school', 'college', 'advanced'];
  return {
    readingComfort: comfort, interests,
    purpose: purposes.includes(r.purpose as string) ? (r.purpose as Purpose) : undefined,
    ageBand: ages.includes(r.ageBand as string) ? (r.ageBand as AgeBand) : undefined,
    schooling: schools.includes(r.schooling as string) ? (r.schooling as Schooling) : undefined,
    updatedAt: Number.isFinite(r.updatedAt) ? Number(r.updatedAt) : 0,
  };
}

export type ProfilePrefs = Prefs & { profile?: LearnerProfile };
