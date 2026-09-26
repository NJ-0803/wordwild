import type { LearnerState, TownEvent } from './types.ts';
import { dayIndex } from './state.ts';
import { SCENES, SCENE_BY_ID } from './story.ts';
import { GAMES, type Game } from './play.ts';
import { PLAN, cityView, civicBuilt, cityPoints, type CityView } from './city.ts';

/**
 * Wordwild Town: a Township-style city that grows with the words you log (see city.ts). There is nothing to harvest, spend or claim.
 * Story scenes belong to the civic buildings; a scene opens once its building has been built by your points.
 * Everything here is derived from events, so it syncs and cannot be forged.
 */
export interface BuildingDef { id: string; name: string; chapter: string; story: string; topics: string[] }

// The life-journey chapters. Each belongs to one civic piece of the city plan and opens when that piece is built.
export const BUILDINGS: BuildingDef[] = [
  { id: 'home', name: 'Home', chapter: 'First discoveries', story: 'Where every word starts: family, food, feelings.', topics: ['family', 'emotion'] },
  { id: 'market', name: 'Market', chapter: 'Buying and selling', story: 'Meena runs the stall. Money words help you bargain and be understood.', topics: ['money', 'business'] },
  { id: 'school', name: 'School', chapter: 'A bigger world', story: 'Friends, teamwork and asking questions. Words for explaining and comparing.', topics: ['school', 'family'] },
  { id: 'cafe', name: 'Café', chapter: 'Around the table', story: 'Ravi serves tea. Kind words, polite words, and words for food.', topics: ['cooking', 'family'] },
  { id: 'workshop', name: 'Workshop', chapter: 'Making your way', story: 'Work, plans and promises. Words for meetings and messages.', topics: ['work', 'business', 'technology'] },
  { id: 'clinic', name: 'Clinic', chapter: 'Looking after people', story: 'Dr. Asha listens. Words for health, worry and comfort.', topics: ['health', 'emotion'] },
  { id: 'hall', name: 'Community hall', chapter: 'Supporting others', story: 'Speaking up, persuading, disagreeing kindly.', topics: ['news', 'law'] },
  { id: 'library', name: 'Library', chapter: 'Sharing your story', story: 'Memory, wisdom and the words that stay with you.', topics: ['school', 'religion'] },
];
export const BUILDING_BY_ID: Record<string, BuildingDef> = Object.fromEntries(BUILDINGS.map(b => [b.id, b]));

export interface TownView extends CityView {
  xp: number; level: number; levelProgress: number; xpToNext: number;
  buildings: (BuildingDef & { status: 'built' | 'locked'; at: number })[];
}

export function townView(state: LearnerState, _now = 0, _tz = 0): TownView {
  const c = cityView(state);
  return {
    ...c, xp: c.points, level: Math.max(1, c.size), levelProgress: c.progress, xpToNext: c.toNext,
    buildings: BUILDINGS.map(b => { const piece = PLAN.find(p => p.civic === b.id); return { ...b, at: piece?.at ?? 0, status: piece && c.builtIds.has(piece.id) ? 'built' as const : 'locked' as const }; }),
  };
}
export { cityPoints };
export const builtIds = (s: LearnerState) => cityView(s).builtIds;

export type ActionResult = { ok: true; state: LearnerState } | { ok: false; reason: string };

/** Finishing a scene is rewarded once, in a building that has been built. Replaying it later is free and gives nothing. */
export function finishScene(state: LearnerState, sceneId: string, now: number): ActionResult {
  const sc = SCENE_BY_ID[sceneId]; if (!sc) return { ok: false, reason: 'unknown-scene' };
  if (!civicBuilt(state, sc.building)) return { ok: false, reason: 'not-built' };
  if (state.town.some(e => e.kind === 'scene' && e.ref === sceneId)) return { ok: false, reason: 'already-seen' };
  const ev: TownEvent = { key: `scene:${sceneId}`, kind: 'scene', ref: sceneId, at: Math.max(now, state.lastClock) };
  return { ok: true, state: { ...state, lastClock: ev.at, town: [...state.town, ev] } };
}
export const scenesFor = (buildingId: string) => SCENES.filter(s => s.building === buildingId);
export const seenScenes = (s: LearnerState) => new Set(s.town.filter(e => e.kind === 'scene').map(e => e.ref));

/** Finishing a daily puzzle is rewarded once per game per day. `ref` is `game:day`; a puzzle from another day cannot be claimed today. */
export const playRef = (game: Game, day: number) => `${game}:${day}`;
const parsePlay = (ref: string): { game: Game; day: number } | null => { const [g, d] = String(ref).split(':'); const day = Number(d); return (GAMES as readonly string[]).includes(g) && Number.isInteger(day) && day > 0 ? { game: g as Game, day } : null; };
export function finishPlay(state: LearnerState, ref: string, now: number): ActionResult {
  const p = parsePlay(ref); if (!p) return { ok: false, reason: 'bad-puzzle' };
  if (Math.abs(p.day - dayIndex(now, 0)) > 1) return { ok: false, reason: 'not-today' };
  if (state.town.some(e => e.kind === 'play' && e.ref === ref)) return { ok: false, reason: 'already-played' };
  const ev: TownEvent = { key: `play:${ref}`, kind: 'play', ref, at: Math.max(now, state.lastClock) };
  return { ok: true, state: { ...state, lastClock: ev.at, town: [...state.town, ev] } };
}
export const playedToday = (s: LearnerState, day: number) => new Set(s.town.filter(e => e.kind === 'play').map(e => e.ref).filter(r => parsePlay(r)?.day === day).map(r => parsePlay(r)!.game));

export function applyTownEvent(state: LearnerState, e: TownEvent): LearnerState {
  const r = e.kind === 'scene' ? finishScene(state, e.ref, e.at) : e.kind === 'play' ? finishPlay(state, e.ref, e.at) : { ok: false as const, reason: 'retired' };
  return r.ok ? { ...r.state, town: r.state.town.map(t => (t.key === e.key ? { ...t, at: e.at } : t)) } : state;
}

export const sanitizeTownEvents = (raw: unknown): TownEvent[] => {
  const out: TownEvent[] = [];
  for (const e of (Array.isArray(raw) ? raw : []).slice(0, 300)) {
    if (!e || typeof e.key !== 'string' || e.key.length > 80 || !Number.isFinite(e.at)) continue;
    else if (e.kind === 'play' && typeof e.ref === 'string' && e.ref.length < 30 && parsePlay(e.ref) && e.key === `play:${e.ref}`) out.push({ key: e.key, kind: 'play', ref: e.ref, at: e.at });
    else if (e.kind === 'scene' && SCENE_BY_ID[e.ref] && e.key === `scene:${e.ref}`) out.push({ key: e.key, kind: 'scene', ref: e.ref, at: e.at });
  }
  return out;
}
