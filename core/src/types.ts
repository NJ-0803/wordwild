export type Lang = 'en' | 'hi' | 'pa';
export type Skill = 'listening' | 'reading' | 'meaning' | 'recall' | 'usage';
export type Register = 'informal' | 'neutral' | 'formal' | 'technical' | 'sensitive';
export type ReviewStatus = 'fixture-unreviewed' | 'editor-reviewed' | 'licensed-verified' | 'dictionary-source' | 'ai-enriched-unreviewed';
/** curated = hand-authored + fully validated; dictionary = facts straight from a licensed dictionary, no practice yet;
 *  enriched = dictionary facts + AI-generated learner content that passed validation and a blind-solver check. */
export type SenseTier = 'curated' | 'dictionary' | 'enriched';

/** One meaning of one word. senseId is stable across content versions. */
export interface Sense {
  senseId: string;              // e.g. "euphemism.n.1"
  lemma: string;
  lang: 'en';
  pos: 'noun' | 'verb' | 'adjective' | 'adverb';
  contentVersion: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  definition: string;
  simple: string;
  pronunciation: { text: string; syllables: string[]; audioUrl: string | null };
  /** Explanation in the learner's strongest language. Absent language => UI must say so. */
  explanations: Partial<Record<Lang, string>>;
  examples: { text: string; context: string }[];      // >= 3, distinct contexts
  collocations: string[];
  relatedForms: string[];
  grammar: string[];
  nearSynonyms: { lemma: string; distinction: string }[];
  antonyms: string[];
  register: Register;
  suitableSituations: string[];
  unsuitableUses: string[];
  prerequisites: string[];      // senseIds
  related: string[];            // senseIds
  provenance: { source: string; licence: string; status: ReviewStatus; updated: string; tier?: SenseTier; generatedBy?: string };
  practice: PracticeItem[];
}

/** Authored, validated activity data. Runtime AI may not add items without passing validateSense. */
export type ActivityKind =
  | 'meaning-bridge' | 'conversation-choice' | 'listen-and-find'
  | 'word-connections' | 'explain-back' | 'memory-encounter';

export interface Option { id: string; text: string; errorType?: ErrorType; why?: string }
export type ErrorType = 'meaning' | 'grammar' | 'register' | 'unusual' | 'sense-confusion';

export interface ChoiceItem {
  id: string; kind: Exclude<ActivityKind, 'explain-back'>; skill: Skill;
  prompt: string;
  /** For listen-and-find: text spoken by TTS; prompt is then shown only as a caption. */
  spoken?: string;
  options: Option[];            // exactly one is correct
  correctId: string;
  explanation: string;
  hint: string;
}
export interface ExplainItem {
  id: string; kind: 'explain-back'; skill: 'usage';
  prompt: string;
  /** Concept groups; a group is covered if any of its terms appears. Not a correctness test. */
  concepts: { name: string; terms: string[] }[];
  modelAnswer: string; hint: string;
}
export type PracticeItem = ChoiceItem | ExplainItem;

export interface Capture {
  query: string; senseId: string | null;   // null => pending
  context: string; source: string; at: number;
  status: 'resolved' | 'pending' | 'unknown';
}

export interface SkillEvidence {
  correct: number; incorrect: number; independentCorrect: number; assisted: number;
  distinctActivities: string[]; lastAt: number; lastCorrect: boolean;
}
export interface SenseRecord {
  senseId: string; capturedAt: number;
  stage: number; due: number; lastAttemptAt: number;
  evidence: Partial<Record<Skill, SkillEvidence>>;
  confusions: Record<string, number>;   // errorType -> count
  lastActivityId: string | null;
}
export interface Attempt {
  key: string; senseId: string; activityId: string; skill: Skill;
  /** null = uncertain (free-answer feedback we cannot judge): recorded, but changes no evidence or schedule. */
  correct: boolean | null; hintsUsed: number; errorType: ErrorType | null; at: number;
}
export interface RewardEntry { key: string; kind: 'discovery' | 'mastery' | 'welcome'; points: number; at: number }
export interface Prefs {
  explainLang: Lang; textScale: number; reducedMotion: boolean; audioFirst: boolean; simpleMode: boolean;
  /** Optional, skippable, private to the learner. See level.ts for how it is (and is not) used. */
  profile?: import('./level.ts').LearnerProfile;
}
/** A town action. Grow-only and idempotent by key, so it syncs like attempts do. */
export interface TownEvent { key: string; kind: 'build' | 'claim' | 'scene' | 'play'; ref: string; at: number }

export interface LearnerState {
  version: 2;
  town: TownEvent[];
  prefs: Prefs;
  captures: Capture[];
  senses: Record<string, SenseRecord>;
  attempts: Record<string, Attempt>;
  rewards: RewardEntry[];
  recommendations: Recommendation[];
  lastClock: number;
}
export interface Recommendation {
  senseId: string; kind: 'review' | 'learn' | 'prerequisite'; at: number;
  reason: { code: string; text: string; factors: Record<string, number | string> };
}
