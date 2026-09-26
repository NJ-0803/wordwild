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
  sector?: [number, number];           // which sector of the city this piece belongs to (0,0 is the original town)
  opens?: boolean;                     // building this piece opens the sector: its avenues, roundabouts and trees
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
  P('avenues', 'Avenues and roundabouts', 'road', 310, 'Wide avenues with trees, and roundabouts at the corners.', 0.5, 0.5, 'city/tree_avenue', { items: [], civic: undefined }),
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

// ---------------------------------------------------------------------------------------------------------------------
// Endless growth. After the hand-made plan the city keeps adding sectors: planned blocks with wide tree-lined avenues, roundabouts,
// parks, markets and civic buildings. Everything is a pure function of the piece number, so it never needs storing.
export const SECTOR_W = 50, SECTOR_H = 42;
const SECTOR_ORDER: [number, number][] = (() => {
  const out: [number, number][] = [];
  for (let r = 1; r <= 9; r++) {
    const c: [number, number][] = [];
    for (let j = 0; j <= r; j++) for (let i = -r; i <= r; i++) if (Math.max(Math.abs(i), j) === r) c.push([i, j]);
    c.sort((a, b) => Math.abs(a[0]) - Math.abs(b[0]) || a[1] - b[1] || a[0] - b[0]);
    out.push(...c);
  }
  return out;
})();
export const sectorAt = (n: number): [number, number] => (n === 0 ? [0, 0] : SECTOR_ORDER[(n - 1) % SECTOR_ORDER.length]);
export const sectorOrigin = (s: [number, number]): [number, number] => [s[0] * SECTOR_W, s[1] * SECTOR_H];

type Role = 'civic' | 'house' | 'shop' | 'park' | 'farm';
interface Spec { name: string; kind: PieceKind; unit: number; blurb: string }
const CAT: Record<Role, Record<string, Spec>> = {
  civic: {
    museum: { name: 'Museum', kind: 'civic', unit: 1.85, blurb: 'Stories and old things, kept safe.' }, hospital: { name: 'Hospital', kind: 'civic', unit: 1.8, blurb: 'Care for the whole town.' },
    college: { name: 'College', kind: 'civic', unit: 1.7, blurb: 'A place to keep learning.' }, assembly: { name: 'Assembly hall', kind: 'civic', unit: 1.75, blurb: 'Where big decisions are made.' },
    bank: { name: 'Bank', kind: 'civic', unit: 1.9, blurb: 'Safe and steady.' }, postoffice: { name: 'Post office', kind: 'civic', unit: 2.1, blurb: 'Letters and parcels arrive here.' },
    firestation: { name: 'Fire station', kind: 'civic', unit: 1.9, blurb: 'Always ready to help.' }, stadium: { name: 'Stadium', kind: 'landmark', unit: 1.8, blurb: 'Match day is the best day.' },
  },
  house: {
    house_blue: { name: 'Blue house', kind: 'house', unit: 1.9, blurb: 'A sunny home.' }, house_mint: { name: 'Mint house', kind: 'house', unit: 1.9, blurb: 'A fresh new home.' },
    house_plum: { name: 'Plum house', kind: 'house', unit: 1.9, blurb: 'A cosy home.' }, house_sand: { name: 'Sand house', kind: 'house', unit: 1.9, blurb: 'A warm home.' },
    cottage: { name: 'Cottage', kind: 'house', unit: 1.9, blurb: 'Small and friendly.' }, house_red: { name: 'Family house', kind: 'house', unit: 1.9, blurb: 'Room for everyone.' },
    villa: { name: 'Villa', kind: 'house', unit: 1.85, blurb: 'A grand home.' }, townhouse: { name: 'Townhouse', kind: 'house', unit: 2.0, blurb: 'Tall and narrow.' },
    modern: { name: 'Modern house', kind: 'house', unit: 2.1, blurb: 'Clean lines and big windows.' }, terrace: { name: 'Terrace homes', kind: 'house', unit: 1.9, blurb: 'Neighbours side by side.' },
    apartments: { name: 'Apartments', kind: 'house', unit: 1.85, blurb: 'Homes for many families.' }, farmhouse: { name: 'Farmhouse', kind: 'house', unit: 1.9, blurb: 'Close to the fields.' },
  },
  shop: {
    bakery: { name: 'Bakery', kind: 'shop', unit: 1.9, blurb: 'Fresh bread.' }, cafe: { name: 'Café', kind: 'shop', unit: 1.9, blurb: 'Tea and talk.' },
    arcade: { name: 'Market arcade', kind: 'shop', unit: 1.85, blurb: 'A row of shops under one roof.' }, hotel: { name: 'Hotel', kind: 'shop', unit: 1.9, blurb: 'Visitors come to stay.' },
    busstation: { name: 'Bus station', kind: 'landmark', unit: 1.9, blurb: 'Buses come and go.' }, workshop: { name: 'Workshop', kind: 'shop', unit: 1.9, blurb: 'Things get made here.' },
  },
  park: {
    rosegarden: { name: 'Rose garden', kind: 'park', unit: 1.9, blurb: 'Hundreds of roses in bloom.' }, lake: { name: 'Lake', kind: 'park', unit: 1.15, blurb: 'Boats on the water.' },
    leisure: { name: 'Leisure park', kind: 'park', unit: 1.9, blurb: 'Shade, benches and paths.' }, monument: { name: 'Monument', kind: 'landmark', unit: 1.9, blurb: 'A landmark for the town.' },
    fountain: { name: 'Fountain', kind: 'park', unit: 1.9, blurb: 'Water sparkling in the sun.' }, gazebo: { name: 'Bandstand', kind: 'park', unit: 1.9, blurb: 'Music in the park.' },
    playground: { name: 'Playground', kind: 'park', unit: 1.9, blurb: 'Laughter all afternoon.' }, pond: { name: 'Pond', kind: 'park', unit: 1.5, blurb: 'A quiet corner.' },
  },
  farm: {
    field_wheat: { name: 'Wheat field', kind: 'farm', unit: 2.2, blurb: 'Golden wheat.' }, field_corn: { name: 'Corn field', kind: 'farm', unit: 2.2, blurb: 'Tall corn.' },
    field_veg: { name: 'Vegetable garden', kind: 'farm', unit: 2.2, blurb: 'Fresh greens.' }, barn: { name: 'Barn', kind: 'farm', unit: 1.9, blurb: 'Room for the harvest.' },
    windmill: { name: 'Windmill', kind: 'farm', unit: 2.0, blurb: 'Turning in the breeze.' }, greenhouse: { name: 'Greenhouse', kind: 'farm', unit: 1.9, blurb: 'Plants all year round.' },
    tree_fruit: { name: 'Orchard', kind: 'farm', unit: 1.8, blurb: 'Fruit trees in rows.' },
  },
};
const XS = [-19, -14, -9.2, -4.6, 4.6, 9.2, 14, 19];
interface Lot { x: number; z: number; role: Role }
const LOTS: Lot[] = (() => {
  const out: Lot[] = [];
  for (const x of XS) {
    out.push({ x, z: -8.4, role: 'civic' });
    out.push({ x, z: 0, role: Math.abs(x) === 4.6 ? 'park' : 'house' });
    out.push({ x, z: 8.6, role: Math.abs(x) <= 9.2 ? 'shop' : 'house' });
    if (Math.abs(x) >= 4.6 && Math.abs(x) <= 14) out.push({ x: x < 0 ? x - 1.5 : x + 1.5, z: 14.4, role: 'farm' });
  }
  return out.sort((a, b) => (Math.abs(a.x) + Math.abs(a.z) * 0.7) - (Math.abs(b.x) + Math.abs(b.z) * 0.7) || a.x - b.x || a.z - b.z);
})();
const PER_SECTOR = LOTS.length + 1;                       // the opening piece plus every lot
const seeded = (seed: number) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const shuffle = <T,>(list: T[], seed: number): T[] => { const r = seeded(seed), a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** How many points the piece with this number (0 = first piece of the whole plan) needs. Later pieces need a little more each time. */
const HAND = PLAN.length;
const LAST_HAND_AT = PLAN[PLAN.length - 1].at;
const gap = (k: number) => 26 + Math.min(44, Math.floor(k / 10) * 2);
const extraAt = (k: number) => { let at = LAST_HAND_AT; for (let i = 0; i <= k; i++) at += gap(i); return at; };
const atCache: number[] = [];
const atFor = (k: number) => { for (let i = atCache.length; i <= k; i++) atCache[i] = i === 0 ? LAST_HAND_AT + gap(0) : atCache[i - 1] + gap(i); return atCache[k]; };
void extraAt;

/** Piece number n (0-based over the whole plan). The first few are hand-made; everything after is generated, sector by sector. */
const pieceCache: PieceDef[] = [];
export function planPiece(n: number): PieceDef {
  return (pieceCache[n] ??= makePiece(n));            // pure and deterministic, so each piece is worked out once
}
function makePiece(n: number): PieceDef {
  if (n < HAND) return PLAN[n];
  const k = n - HAND, sn = Math.floor(k / PER_SECTOR) + 1, idx = k % PER_SECTOR, sec = sectorAt(sn), [ox, oz] = sectorOrigin(sec);
  const at = atFor(k);
  if (idx === 0) return { id: `s${sn}-open`, name: `Sector ${sn + 1}`, kind: 'road', at, blurb: 'A new sector opens, with avenues, trees and a roundabout.', slot: [ox, oz], rot: 0, unit: 1, items: [], sector: sec, opens: true };
  const lot = LOTS[idx - 1], deck = shuffle(Object.keys(CAT[lot.role]), sn * 977 + lot.role.length * 31 + 5);
  const rank = LOTS.slice(0, idx - 1).filter(l => l.role === lot.role).length;
  const model = deck[rank % deck.length], spec = CAT[lot.role][model];
  const isField = model.startsWith('field_');
  return { id: `s${sn}-${idx}`, name: spec.name, kind: spec.kind, at, blurb: spec.blurb, slot: [ox + lot.x, oz + lot.z], rot: 0, unit: spec.unit, items: [{ model: `city/${model}` }], sector: sec, ...(isField ? {} : {}) };
}

export interface PieceView extends PieceDef { status: 'built' | 'next' | 'later' }
export interface SectorView { i: number; j: number; ox: number; oz: number; avenues: boolean }
export interface CityView {
  points: number; pieces: PieceView[]; built: PieceView[]; next: PieceView | null; upcoming: PieceView[]; toNext: number; progress: number; size: number; title: string;
  builtIds: Set<string>; sectors: SectorView[];
}
export const CITY_TITLES: [number, string][] = [[0, 'Hamlet'], [6, 'Village'], [14, 'Town'], [26, 'Small city'], [37, 'City'], [70, 'Big city'], [130, 'Metropolis'], [260, 'Capital']];
export const titleFor = (n: number) => [...CITY_TITLES].reverse().find(([k]) => n >= k)![1];

let lastView: CityView | null = null;
export function cityView(state: LearnerState): CityView {
  const points = cityPoints(state);
  if (lastView && lastView.points === points) return lastView;          // same points, same city: keep the same object so screens do not redraw
  return (lastView = buildView(points));
}
function buildView(points: number): CityView {
  const built: PieceView[] = []; let n = 0;
  for (;;) { const p = planPiece(n); if (p.at > points) break; built.push({ ...p, status: 'built' }); n++; }
  const nextDef = planPiece(n); const next: PieceView = { ...nextDef, status: 'next' };
  const upcoming: PieceView[] = [next, ...[1, 2, 3].map(d => ({ ...planPiece(n + d), status: 'later' as const }))];
  const prevAt = built.length ? built[built.length - 1].at : 0;
  const sectors: SectorView[] = [{ i: 0, j: 0, ox: 0, oz: 0, avenues: built.some(p => p.id === 'avenues') }];
  for (const p of built) if (p.opens && p.sector) { const [ox, oz] = sectorOrigin(p.sector); sectors.push({ i: p.sector[0], j: p.sector[1], ox, oz, avenues: true }); }
  return { points, pieces: [...built, next], built, next, upcoming, toNext: next.at - points, progress: (points - prevAt) / Math.max(1, next.at - prevAt), size: built.length, title: titleFor(built.length),
    builtIds: new Set(built.map(p => p.id)), sectors };
}
export const civicBuilt = (state: LearnerState, chapter: string) => PLAN.some(p => p.civic === chapter && cityPoints(state) >= p.at);
