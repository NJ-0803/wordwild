import type { LearnerState } from './types.ts';
import { masteryLevel } from './engine.ts';
import { PLAY_POINTS } from './play.ts';

/**
 * The city grows with the words you log. Nothing is spent, harvested or claimed: every saved word, every practice and every secure word adds
 * points, and each threshold adds one more piece to a planned town (houses of different kinds, shops, farms, parks, landmarks).
 * Points only ever go up, so the town never shrinks. Everything is derived from what the learner did, so it syncs and cannot be forged.
 */
export const POINTS = { saved: 3, practised: 2, secure: 5, puzzle: PLAY_POINTS, scene: 3 };

export function cityPoints(s: LearnerState): number {
  const recs = Object.values(s.senses);
  return recs.length * POINTS.saved
    + recs.filter(r => r.lastAttemptAt > 0).length * POINTS.practised
    + recs.filter(r => masteryLevel(r) === 'secure').length * POINTS.secure
    + s.town.filter(e => e.kind === 'play').length * POINTS.puzzle
    + s.town.filter(e => e.kind === 'scene').length * POINTS.scene;
}

export type PieceKind = 'house' | 'shop' | 'civic' | 'farm' | 'park' | 'landmark' | 'road';
export interface Item { model: string; dx?: number; dz?: number; rot?: number; unit?: number }
export interface PieceDef {
  id: string; name: string; kind: PieceKind; at: number; blurb: string;
  slot: [number, number]; rot: number; unit: number; items: Item[];
  civic?: string;                      // a story chapter that opens when this piece is built
}
const P = (id: string, name: string, kind: PieceKind, at: number, blurb: string, x: number, z: number, model: string, o: { rot?: number; unit?: number; civic?: string; items?: Item[] } = {}): PieceDef =>
  ({ id, name, kind, at, blurb, slot: [x, z], rot: o.rot ?? 0, unit: o.unit ?? 1.9, civic: o.civic, items: o.items ?? [{ model }] });
const N = -8.4, M = 0, S = 8.6, F = 14.4, FACE_S = 0;

/** The plan, in the order the city grows. `at` is the number of points that builds each piece. */
export const PLAN: PieceDef[] = [
  P('home', 'Your cottage', 'house', 0, 'Where every word starts.', -14, M, 'city/cottage', { civic: 'home' }),
  P('wheat', 'Wheat seeds', 'farm', 3, 'Your first seeds are in the ground.', -10.5, F, 'city/field_wheat', { unit: 2.2 }),
  P('lamps', 'Street lamps', 'road', 6, 'The streets light up after dark.', 0, 0, 'city/lamp', { items: [-14, -7, 7, 14].flatMap(x => [{ model: 'city/lamp', dx: x, dz: -5.3 }, { model: 'city/lamp', dx: x, dz: 5.3 }]).map(i => ({ ...i, unit: 1.3 })) }),
  P('house1', 'Family house', 'house', 10, 'A family moves in.', -9.2, M, 'city/house_red'),
  P('market', 'Market', 'shop', 15, 'Meena opens her stall.', -9.2, S, 'city/market_stall', { rot: FACE_S, civic: 'market', unit: 2.1, items: [{ model: 'city/market_stall', dx: -1.3 }, { model: 'city/market_stall', dx: 1.3 }] }),
  P('veg', 'Vegetable garden', 'farm', 20, 'Greens for the market.', -5.8, F, 'city/field_veg', { unit: 2.2 }),
  P('townhouse1', 'Townhouse', 'house', 26, 'A tall, narrow home.', 9.2, M, 'city/townhouse', { unit: 2.0 }),
  P('school', 'School', 'civic', 33, 'Friends, teamwork and questions.', -14, N, 'city/school', { civic: 'school', unit: 1.85 }),
  P('orchard', 'Orchard', 'farm', 40, 'Apple trees along the fence.', -17.5, 5, 'city/tree_fruit', { unit: 1.8, items: [-2, 0, 2].flatMap(dz => [{ model: 'city/tree_fruit', dz: dz * 1.9 }, { model: 'city/tree_fruit', dx: 2.4, dz: dz * 1.9 + 0.9 }]) }),
  P('bakery', 'Bakery', 'shop', 48, 'Fresh bread every morning.', -4.6, S, 'city/bakery', { rot: FACE_S }),
  P('fountain', 'Town fountain', 'park', 56, 'The heart of the town square.', -4.6, M, 'city/fountain', { unit: 1.9 }),
  P('villa1', 'Villa', 'house', 66, 'A sunny villa with a terracotta roof.', 14, M, 'city/villa', { unit: 1.85 }),
  P('cafe', 'Café', 'shop', 76, 'Ravi serves tea.', -14, S, 'city/cafe', { rot: FACE_S, civic: 'cafe' }),
  P('corn', 'Corn field', 'farm', 87, 'Tall corn, ready by summer.', 5.8, F, 'city/field_corn', { unit: 2.2 }),
  P('barn', 'Red barn', 'farm', 99, 'Room for the harvest.', -16.4, 11.5, 'city/barn', { rot: 0, unit: 1.9 }),
  P('playground', 'Playground', 'park', 112, 'Children play in the square.', 14, S, 'city/playground', { rot: FACE_S, unit: 1.9 }),
  P('workshop', 'Workshop', 'civic', 126, 'Making your way.', 9.2, N, 'city/workshop', { civic: 'workshop', unit: 1.9 }),
  P('apartments', 'Apartments', 'house', 141, 'Homes for many families.', 14, N, 'city/apartments', { rot: FACE_S, unit: 1.85 }),
  P('windmill', 'Windmill', 'farm', 157, 'The blades turn in the breeze.', 16, 13.6, 'city/windmill', { unit: 2.0 }),
  P('clinic', 'Clinic', 'civic', 174, 'Dr. Asha listens.', 4.6, N, 'city/clinic', { civic: 'clinic', unit: 1.9 }),
  P('gazebo', 'Bandstand', 'park', 192, 'Music on Sunday afternoons.', 4.6, M, 'city/gazebo', { unit: 1.9 }),
  P('farmhouse', 'Farmhouse', 'house', 211, 'A farm family moves in.', 9.2, S, 'city/farmhouse', { rot: FACE_S }),
  P('hall', 'Community hall', 'civic', 231, 'Speaking up and listening.', -4.6, N, 'city/hall', { civic: 'hall', unit: 1.8 }),
  P('greenhouse', 'Greenhouse', 'farm', 252, 'Seedlings all year round.', 0, 15.2, 'city/greenhouse', { unit: 1.9 }),
  P('pond', 'Duck pond', 'park', 274, 'A quiet corner with lily pads.', 17.5, 3.6, 'city/pond', { unit: 1.5 }),
  P('library', 'Library', 'civic', 297, 'Memory, wisdom and stories.', -9.2, N, 'city/library', { civic: 'library', unit: 1.9 }),
  P('clocktower', 'Clock tower', 'landmark', 321, 'The town keeps good time.', 19, N, 'city/clocktower', { unit: 1.9 }),
  P('wheat2', 'Second wheat field', 'farm', 346, 'The harvest doubles.', 10.5, F, 'city/field_wheat', { unit: 2.2 }),
  P('house2', 'Cottage', 'house', 372, 'A new cottage on the east side.', 19, M, 'city/cottage', { rot: 0 }),
  P('house3', 'Family house', 'house', 400, 'Another family arrives.', -19, M, 'city/house_red', { rot: 0 }),
  P('townhouse2', 'Townhouse', 'house', 430, 'Rows of homes along the road.', -19, N, 'city/townhouse', { rot: 0, unit: 2.0 }),
  P('villa2', 'Villa', 'house', 462, 'A grand home by the river.', 4.6, S, 'city/villa', { rot: 0, unit: 1.85 }),
  P('apartments2', 'Apartments', 'house', 496, 'The town keeps growing.', 19, S, 'city/apartments', { rot: 0, unit: 1.85 }),
  P('bakery2', 'Corner shop', 'shop', 532, 'A second shop opens.', -19, S, 'city/bakery', { rot: 0 }),
  P('grove', 'Tree grove', 'park', 570, 'Shade for everyone.', 0, -11.6, 'city/tree_round', { unit: 1.8, items: [-6, -3, 0, 3, 6].map(dx => ({ model: 'city/tree_round', dx, dz: (dx % 2 ? 0.8 : -0.4) })) }),
  P('wheat3', 'Meadow garden', 'farm', 610, 'Flowers and herbs.', -1, 19.5, 'city/field_veg', { unit: 2.2 }),
];

export interface PieceView extends PieceDef { status: 'built' | 'next' | 'later' }
export interface CityView {
  points: number; pieces: PieceView[]; built: PieceView[]; next: PieceView | null; toNext: number; progress: number; size: number; title: string;
  builtIds: Set<string>;
}
export const CITY_TITLES: [number, string][] = [[0, 'Hamlet'], [6, 'Village'], [14, 'Town'], [26, 'Small city'], [36, 'City']];
export const titleFor = (n: number) => [...CITY_TITLES].reverse().find(([k]) => n >= k)![1];

export function cityView(state: LearnerState): CityView {
  const points = cityPoints(state);
  const done = PLAN.filter(p => points >= p.at);
  const next = PLAN.find(p => points < p.at) ?? null;
  const prevAt = done.length ? done[done.length - 1].at : 0;
  const pieces: PieceView[] = PLAN.map(p => ({ ...p, status: points >= p.at ? 'built' : p === next ? 'next' : 'later' }));
  return { points, pieces, built: pieces.filter(p => p.status === 'built'), next: next ? pieces.find(p => p.id === next.id)! : null,
    toNext: next ? next.at - points : 0, progress: next ? (points - prevAt) / Math.max(1, next.at - prevAt) : 1, size: done.length, title: titleFor(done.length), builtIds: new Set(done.map(p => p.id)) };
}
export const civicBuilt = (state: LearnerState, chapter: string) => PLAN.some(p => p.civic === chapter && cityPoints(state) >= p.at);
