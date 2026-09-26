import type { LearnerState, TownEvent } from './types.ts';
import { dayIndex } from './state.ts';
import { masteryLevel } from './engine.ts';
import { SCENES, SCENE_BY_ID, SCENE_REWARD } from './story.ts';

/**
 * Wordwild Town: a Township-style town whose every fun loop IS the learning loop.
 *  - A saved word is a seed; the wait is its spaced-review interval; reviewing a ripe word is the harvest.
 *  - Coins and XP come ONLY from the reward ledger (real mastery) and from small daily orders measured from real events.
 *  - Buildings are story chapters you unlock and build. Nothing wilts, decays or expires: missing days costs nothing.
 * Everything here is derived from events, so it syncs and cannot be forged.
 */
export interface BuildingDef {
  id: string; name: string; chapter: string; story: string;
  unlockLevel: number; cost: number;
  model: string;                       // GLB under /town/models
  slot: [number, number];              // tile position in the town
  topics: string[];
}

// The life-journey chapters as districts. Chapter unlocking follows what you have learned, never your age.
export const BUILDINGS: BuildingDef[] = [
  { id: 'home',     name: 'Home',            chapter: 'First discoveries',      story: 'Where every word starts: family, food, feelings.',                        unlockLevel: 1, cost: 0,   model: 'suburban/building-type-d', slot: [-4, 0], topics: ['family', 'emotion'] },
  { id: 'market',   name: 'Market',          chapter: 'Buying and selling',     story: 'Meena runs the stall. Money words help you bargain and be understood.',    unlockLevel: 2, cost: 40,  model: 'commercial/building-c',    slot: [4, 0], topics: ['money', 'business'] },
  { id: 'school',   name: 'School',          chapter: 'A bigger world',         story: 'Friends, teamwork and asking questions. Words for explaining and comparing.', unlockLevel: 3, cost: 90,  model: 'suburban/building-type-h', slot: [-4, -8],  topics: ['school', 'family'] },
  { id: 'cafe',     name: 'Café',            chapter: 'Around the table',       story: 'Ravi serves tea. Kind words, polite words, and words for food.',            unlockLevel: 4, cost: 160, model: 'commercial/building-f',    slot: [4, -8],  topics: ['cooking', 'family'] },
  { id: 'workshop', name: 'Workshop',        chapter: 'Making your way',        story: 'Work, plans and promises. Words for meetings and messages.',                unlockLevel: 5, cost: 260, model: 'commercial/building-i',    slot: [-10, 0], topics: ['work', 'business', 'technology'] },
  { id: 'clinic',   name: 'Clinic',          chapter: 'Looking after people',   story: 'Dr. Asha listens. Words for health, worry and comfort.',                    unlockLevel: 6, cost: 380, model: 'commercial/building-k',    slot: [10, 0], topics: ['health', 'emotion'] },
  { id: 'hall',     name: 'Community hall',  chapter: 'Supporting others',      story: 'Speaking up, persuading, disagreeing kindly.',                              unlockLevel: 7, cost: 520, model: 'commercial/building-m',    slot: [-10, -8],  topics: ['news', 'law'] },
  { id: 'library',  name: 'Library',         chapter: 'Sharing your story',     story: 'Memory, wisdom and the words that stay with you.',                          unlockLevel: 8, cost: 700, model: 'suburban/building-type-o', slot: [10, -8],  topics: ['school', 'religion'] },
];
export const BUILDING_BY_ID: Record<string, BuildingDef> = Object.fromEntries(BUILDINGS.map(b => [b.id, b]));

/** One fully learned word is worth 55 points, so the very first mastered word already levels you up: early effort is rewarded quickly. */
/** Levels only go up. Each one asks a little more than the last (50, 60, 70...), so early levels come fast and later ones feel earned. XP is never spent, so spending coins never lowers a level. */
export const XP_PER_LEVEL = 50;
export const xpToReach = (level: number) => XP_PER_LEVEL * (level - 1) + 5 * (level - 1) * (level - 2);
export function levelFromXp(xp: number): { level: number; progress: number; next: number } {
  let level = 1; while (xpToReach(level + 1) <= xp) level++;
  const lo = xpToReach(level), hi = xpToReach(level + 1);
  return { level, progress: (xp - lo) / (hi - lo), next: hi - xp };
}

export interface OrderDef { id: string; giver: string; line: string; target: number; unit: string; coins: number; xp: number }
const ORDERS: OrderDef[] = [
  { id: 'plant2',  giver: 'Meena',    line: 'I need two new words for my stall sign. Save two new words today.',          target: 2, unit: 'new words saved',        coins: 12, xp: 12 },
  { id: 'harvest2', giver: 'Ravi',    line: 'The tea is ready! Bring two ripe words to the table.',                        target: 2, unit: 'words harvested',        coins: 20, xp: 20 },
  { id: 'secure1', giver: 'Dr. Asha', line: 'One word you can truly use, from memory. Make a word secure.',                target: 1, unit: 'words made secure',      coins: 35, xp: 35 },
  { id: 'practise3', giver: 'Teacher Jas', line: 'Let us practise three different words together today.',                   target: 3, unit: 'different words practised', coins: 18, xp: 18 },
  { id: 'explore1', giver: 'The Librarian', line: 'Find a new word next to one you know. Save a word from a constellation.',  target: 1, unit: 'constellation words saved', coins: 15, xp: 15 },
];
export const ORDER_BY_ID: Record<string, OrderDef> = Object.fromEntries(ORDERS.map(o => [o.id, o]));

const rng = (seed: number) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

/** Three orders per day, the same for everyone on that day. They refresh; unclaimed ones vanish silently (no penalty, no backlog). */
export function ordersForDay(day: number): OrderDef[] {
  const r = rng(day * 7919 + 13); const pool = [...ORDERS];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, 3);
}
export const orderRef = (day: number, id: string, tz: number) => `${day}:${id}:${tz}`;
const parseRef = (ref: string) => { const [d, id, tz] = ref.split(':'); return { day: Number(d), id, tz: Number(tz) }; };

const inDay = (t: number, day: number, tz: number) => dayIndex(t, tz) === day;

/** How far along an order is, measured from real events on that day. Nothing here can be set by the client. */
export function orderProgress(state: LearnerState, id: string, day: number, tz: number): number {
  switch (id) {
    case 'plant2': return state.captures.filter(c => c.status === 'resolved' && inDay(c.at, day, tz)).length;
    case 'harvest2': return state.rewards.filter(r => r.key.startsWith('mastery:stage:') && inDay(r.at, day, tz)).length;
    case 'secure1': return state.rewards.filter(r => r.key.startsWith('mastery:secure:') && inDay(r.at, day, tz)).length;
    case 'practise3': return new Set(Object.values(state.attempts).filter(a => a.correct !== null && inDay(a.at, day, tz)).map(a => a.senseId)).size;
    case 'explore1': return state.captures.filter(c => c.senseId && c.source === 'Constellation' && inDay(c.at, day, tz)).length;
    default: return 0;
  }
}

export interface Plot { senseId: string; stage: 0 | 1 | 2 | 3; ripe: boolean; firstTime: boolean; dueAt: number; dueInMs: number }
export type BuildingStatus = 'built' | 'ready' | 'saving' | 'locked';
export interface TownView {
  xp: number; level: number; levelProgress: number; xpToNext: number; coins: number; spent: number;
  plots: Plot[]; ripeCount: number;
  buildings: (BuildingDef & { status: BuildingStatus; needCoins: number })[];
  orders: (OrderDef & { ref: string; progress: number; done: boolean; claimed: boolean })[];
}

const sceneCount = (s: LearnerState) => s.town.filter(e => e.kind === 'scene').length;
const earnedXp = (s: LearnerState) => s.rewards.reduce((n, r) => n + r.points, 0) + s.town.filter(e => e.kind === 'claim').reduce((n, e) => n + (ORDER_BY_ID[parseRef(e.ref).id]?.xp ?? 0), 0) + sceneCount(s) * SCENE_REWARD.xp;
const spentCoins = (s: LearnerState) => s.town.filter(e => e.kind === 'build').reduce((n, e) => n + (BUILDING_BY_ID[e.ref]?.cost ?? 0), 0);
const claimedCoins = (s: LearnerState) => s.town.filter(e => e.kind === 'claim').reduce((n, e) => n + (ORDER_BY_ID[parseRef(e.ref).id]?.coins ?? 0), 0) + sceneCount(s) * SCENE_REWARD.coins;
export const builtIds = (s: LearnerState) => new Set(['home', ...s.town.filter(e => e.kind === 'build').map(e => e.ref)]);

const STAGE = { new: 0, seen: 1, practising: 2, secure: 3 } as const;

export function townView(state: LearnerState, now: number, tz = 0): TownView {
  const xp = earnedXp(state); const lv = levelFromXp(xp); const level = lv.level;
  const coins = state.rewards.reduce((n, r) => n + r.points, 0) + claimedCoins(state) - spentCoins(state);
  const built = builtIds(state);
  const plots: Plot[] = Object.values(state.senses).map(r => ({
    senseId: r.senseId, stage: STAGE[masteryLevel(r)] as 0 | 1 | 2 | 3,
    firstTime: r.lastAttemptAt === 0, ripe: r.lastAttemptAt === 0 || r.due <= now, dueAt: r.due, dueInMs: Math.max(0, r.due - now),
  }));
  const day = dayIndex(now, tz);
  const claimed = new Set(state.town.filter(e => e.kind === 'claim').map(e => e.ref));
  return {
    xp, level, levelProgress: lv.progress, xpToNext: lv.next, coins, spent: spentCoins(state), plots, ripeCount: plots.filter(p => p.ripe).length,
    buildings: BUILDINGS.map(b => ({
      ...b, needCoins: Math.max(0, b.cost - coins),
      status: built.has(b.id) ? 'built' : level < b.unlockLevel ? 'locked' : coins >= b.cost ? 'ready' : 'saving',
    })),
    orders: ordersForDay(day).map(o => {
      const ref = orderRef(day, o.id, tz); const progress = orderProgress(state, o.id, day, tz);
      return { ...o, ref, progress, done: progress >= o.target, claimed: claimed.has(ref) };
    }),
  };
}

export type ActionResult = { ok: true; state: LearnerState } | { ok: false; reason: string };

export function buildBuilding(state: LearnerState, id: string, now: number): ActionResult {
  const def = BUILDING_BY_ID[id]; if (!def) return { ok: false, reason: 'unknown-building' };
  if (builtIds(state).has(id)) return { ok: false, reason: 'already-built' };
  const v = townView(state, now);
  if (v.level < def.unlockLevel) return { ok: false, reason: 'locked' };
  if (v.coins < def.cost) return { ok: false, reason: 'not-enough-coins' };
  const ev: TownEvent = { key: `build:${id}`, kind: 'build', ref: id, at: Math.max(now, state.lastClock) };
  return { ok: true, state: { ...state, lastClock: ev.at, town: [...state.town, ev] } };
}

export function claimOrder(state: LearnerState, ref: string, now: number): ActionResult {
  const { day, id, tz } = parseRef(ref);
  if (!Number.isInteger(day) || !ORDER_BY_ID[id] || !Number.isFinite(tz)) return { ok: false, reason: 'bad-order' };
  if (!ordersForDay(day).some(o => o.id === id)) return { ok: false, reason: 'not-offered' };
  if (state.town.some(e => e.kind === 'claim' && e.ref === ref)) return { ok: false, reason: 'already-claimed' };
  if (orderProgress(state, id, day, tz) < ORDER_BY_ID[id].target) return { ok: false, reason: 'not-done' };
  const ev: TownEvent = { key: `claim:${ref}`, kind: 'claim', ref, at: Math.max(now, state.lastClock) };
  return { ok: true, state: { ...state, lastClock: ev.at, town: [...state.town, ev] } };
}

/** Replays a town event during sync rebuild. Invalid ones (not enough coins at that moment, order not done) are ignored, never trusted. */
/** Finishing a scene is rewarded once, in a built building. Replaying it later is free and gives nothing. */
export function finishScene(state: LearnerState, sceneId: string, now: number): ActionResult {
  const sc = SCENE_BY_ID[sceneId]; if (!sc) return { ok: false, reason: 'unknown-scene' };
  if (!builtIds(state).has(sc.building)) return { ok: false, reason: 'not-built' };
  if (state.town.some(e => e.kind === 'scene' && e.ref === sceneId)) return { ok: false, reason: 'already-seen' };
  const ev: TownEvent = { key: `scene:${sceneId}`, kind: 'scene', ref: sceneId, at: Math.max(now, state.lastClock) };
  return { ok: true, state: { ...state, lastClock: ev.at, town: [...state.town, ev] } };
}
export const scenesFor = (buildingId: string) => SCENES.filter(s => s.building === buildingId);
export const seenScenes = (s: LearnerState) => new Set(s.town.filter(e => e.kind === 'scene').map(e => e.ref));

export function applyTownEvent(state: LearnerState, e: TownEvent): LearnerState {
  const r = e.kind === 'build' ? buildBuilding(state, e.ref, e.at) : e.kind === 'scene' ? finishScene(state, e.ref, e.at) : claimOrder(state, e.ref, e.at);
  return r.ok ? { ...r.state, town: r.state.town.map(t => (t.key === e.key ? { ...t, at: e.at } : t)) } : state;
}

export const sanitizeTownEvents = (raw: unknown): TownEvent[] => {
  const out: TownEvent[] = [];
  for (const e of (Array.isArray(raw) ? raw : []).slice(0, 300)) {
    if (!e || typeof e.key !== 'string' || e.key.length > 80 || !Number.isFinite(e.at)) continue;
    if (e.kind === 'build' && BUILDING_BY_ID[e.ref] && e.key === `build:${e.ref}`) out.push({ key: e.key, kind: 'build', ref: e.ref, at: e.at });
    else if (e.kind === 'scene' && SCENE_BY_ID[e.ref] && e.key === `scene:${e.ref}`) out.push({ key: e.key, kind: 'scene', ref: e.ref, at: e.at });
    else if (e.kind === 'claim' && typeof e.ref === 'string' && e.ref.length < 60 && ORDER_BY_ID[parseRef(e.ref).id] && e.key === `claim:${e.ref}`) out.push({ key: e.key, kind: 'claim', ref: e.ref, at: e.at });
  }
  return out;
}
