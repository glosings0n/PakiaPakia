import { hasTag, itemCells } from './items';
import {
  type Box,
  pairOk,
  REQUEST_INFO,
  requestIndices,
  type SpecialRequest,
  unaryOk,
} from './requests';
import { candidatesFor, countSolutions } from './solver';
import type { Difficulty, ItemId } from './types';

/**
 * How much planning a bag asks for, measured the way a player feels it.
 *
 * The solver counts valid bags, but two receipts with the same count can feel
 * very different: one packs itself, the other punishes the first careless
 * drop. So we also simulate a naive player: biggest items first (random order
 * among equals), each dropped on a random spot that breaks no rule yet, never
 * undoing. The share of games this player wins is the "naive win rate".
 * Uses the same bit masks and rules as the solver, so it stays fast.
 */

/** Small seeded generator, so ratings are stable from run to run. */
export const makeRng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const NAIVE_TRIALS = 1000;

/**
 * Difficulty bands on the naive win rate (share of careless games that work).
 * Hard: under 4%, the bag needs a real plan. Medium: under 15%. Easy: the
 * rest, up to MAX_WIN_RATE; past it the bag packs itself and is refused.
 */
export const WIN_RATE_BANDS = { hard: 0.04, medium: 0.15 } as const;
export const MAX_WIN_RATE = 0.6;

export const difficultyFor = (winRate: number): Difficulty =>
  winRate < WIN_RATE_BANDS.hard
    ? 'hard'
    : winRate < WIN_RATE_BANDS.medium
      ? 'medium'
      : 'easy';

export type Rating = {
  solvable: boolean;
  /** Distinct valid bags, capped at RATING_CAP. */
  solutions: number;
  /** Share of naive games won, from 0 to 1. */
  winRate: number;
  difficulty: Difficulty;
};

/** Full rating of a receipt: is it packable, how many bags, how hard it feels. */
export const rate = (
  items: readonly ItemId[],
  request: SpecialRequest | null = null
): Rating => {
  const solutions = countSolutions(items, request);
  const winRate = solutions > 0 ? naiveWinRate(items, request) : 0;
  return {
    solvable: solutions > 0,
    solutions,
    winRate,
    difficulty: difficultyFor(winRate),
  };
};

export const naiveWinRate = (
  items: readonly ItemId[],
  request: SpecialRequest | null,
  trials = NAIVE_TRIALS,
  seed = 1
): number => {
  const rng = makeRng(seed);
  const pair = request ? REQUEST_INFO[request.kind].pair : false;
  const { x, y } = request ? requestIndices(items, request) : { x: -1, y: -1 };
  const info = items.map((id) => ({
    id,
    size: itemCells(id),
    list: candidatesFor(id),
    fragile: hasTag(id, 'fragile'),
    hot: hasTag(id, 'hot'),
    cold: hasTag(id, 'cold'),
  }));
  const options: number[] = [];
  let wins = 0;
  // Canonical order first, so the rate does not depend on how the receipt is listed.
  const canonical = info
    .map((it, i) => ({ i, id: it.id, size: it.size }))
    .sort((a, b) => a.id.localeCompare(b.id) || a.i - b.i);

  for (let t = 0; t < trials; t++) {
    const order = canonical
      .map(({ i, size }) => ({ i, size, tie: rng() }))
      .sort((a, b) => b.size - a.size || a.tie - b.tie);
    let occupied = 0;
    let fragileAbove = 0;
    let hotCells = 0;
    let coldCells = 0;
    let boxX: Box | null = null;
    let boxY: Box | null = null;
    let ok = true;

    for (const { i } of order) {
      const it = info[i];
      if (!it) continue;
      options.length = 0;
      for (let k = 0; k < it.list.length; k++) {
        const cand = it.list[k];
        if (!cand) continue;
        if (cand.mask & occupied) continue;
        if (cand.mask & fragileAbove) continue;
        if (it.fragile && cand.above & occupied) continue;
        if (it.hot && cand.neighbours & coldCells) continue;
        if (it.cold && cand.neighbours & hotCells) continue;
        if (request) {
          if (i === x && !pair && !unaryOk(request.kind, cand.box)) continue;
          if (pair && i === x && boxY && !pairOk(request.kind, cand.box, boxY))
            continue;
          if (pair && i === y && boxX && !pairOk(request.kind, boxX, cand.box))
            continue;
        }
        options.push(k);
      }
      if (options.length === 0) {
        ok = false;
        break;
      }
      const cand = it.list[options[Math.floor(rng() * options.length)] ?? 0];
      if (!cand) {
        ok = false;
        break;
      }
      occupied |= cand.mask;
      if (it.fragile) fragileAbove |= cand.above;
      if (it.hot) hotCells |= cand.mask;
      if (it.cold) coldCells |= cand.mask;
      if (i === x) boxX = cand.box;
      if (i === y) boxY = cand.box;
    }
    if (ok) wins++;
  }
  return wins / trials;
};
