import { footprint, hasTag, itemCells } from './items';
import {
  type Box,
  pairOk,
  REQUEST_INFO,
  requestIndices,
  type SpecialRequest,
  unaryOk,
} from './requests';
import type { ItemId, Placement } from './types';
import { GRID_COLS, GRID_ROWS } from './types';

/**
 * Exhaustive backtracking solver over 25-bit cell masks. Used to prove that
 * every daily receipt and every community receipt can be packed, and to rate
 * how hard it is (fewer valid bags = harder).
 */

type Candidate = {
  r: number;
  c: number;
  rot: boolean;
  mask: number;
  /** Cells strictly above this item in its columns (not including itself). */
  above: number;
  /** Orthogonal neighbour cells (not including itself). */
  neighbours: number;
  box: Box;
};

const bit = (r: number, c: number): number => 1 << (r * GRID_COLS + c);

const candidateCache = new Map<ItemId, Candidate[]>();

export const candidatesFor = (id: ItemId): Candidate[] => {
  const cached = candidateCache.get(id);
  if (cached) return cached;
  const rotations = [false];
  const natural = footprint(id, false);
  if (natural.w !== natural.h && !hasTag(id, 'upright')) rotations.push(true);
  const heavy = hasTag(id, 'heavy');
  const list: Candidate[] = [];
  for (const rot of rotations) {
    const { w, h } = footprint(id, rot);
    for (let r = 0; r + h <= GRID_ROWS; r++) {
      if (heavy && r + h !== GRID_ROWS) continue;
      for (let c = 0; c + w <= GRID_COLS; c++) {
        let mask = 0;
        for (let dr = 0; dr < h; dr++)
          for (let dc = 0; dc < w; dc++) mask |= bit(r + dr, c + dc);
        let above = 0;
        for (let dc = 0; dc < w; dc++)
          for (let rr = 0; rr < r; rr++) above |= bit(rr, c + dc);
        let neighbours = 0;
        for (let dr = 0; dr < h; dr++) {
          for (let dc = 0; dc < w; dc++) {
            const cr = r + dr;
            const cc = c + dc;
            if (cr > 0) neighbours |= bit(cr - 1, cc);
            if (cr < GRID_ROWS - 1) neighbours |= bit(cr + 1, cc);
            if (cc > 0) neighbours |= bit(cr, cc - 1);
            if (cc < GRID_COLS - 1) neighbours |= bit(cr, cc + 1);
          }
        }
        neighbours &= ~mask;
        const box = { top: r, bottom: r + h - 1, left: c, right: c + w - 1 };
        list.push({ r, c, rot, mask, above, neighbours, box });
      }
    }
  }
  candidateCache.set(id, list);
  return list;
};

export type SolveResult = {
  /** Number of distinct bags found (identical items are not double counted). */
  count: number;
  /** True when the search stopped at `limit` or `nodeLimit` before finishing. */
  capped: boolean;
  first: Placement[] | null;
  nodes: number;
};

export const solve = (
  items: readonly ItemId[],
  options: {
    limit?: number;
    nodeLimit?: number;
    request?: SpecialRequest | null;
  } = {}
): SolveResult => {
  const limit = options.limit ?? 1;
  const nodeLimit = options.nodeLimit ?? 5_000_000;
  const totalCells = items.reduce((sum, id) => sum + itemCells(id), 0);
  if (totalCells > GRID_ROWS * GRID_COLS)
    return { count: 0, capped: false, first: null, nodes: 0 };

  // Most constrained items first; identical items stay adjacent for symmetry breaking.
  const order = items
    .map((id, i) => ({
      id,
      i,
      n: candidatesFor(id).length,
      size: itemCells(id),
    }))
    .sort((a, b) => a.n - b.n || b.size - a.size || a.id.localeCompare(b.id));

  const chosen: number[] = new Array<number>(order.length).fill(-1);

  // Special request: which instances it names, and where they sit in the search order.
  const request = options.request ?? null;
  const pair = request ? REQUEST_INFO[request.kind].pair : false;
  const named = request ? requestIndices(items, request) : { x: -1, y: -1 };
  const depthX = order.findIndex((o) => o.i === named.x);
  const depthY = order.findIndex((o) => o.i === named.y);
  if (request && (depthX < 0 || (pair && depthY < 0)))
    return { count: 0, capped: false, first: null, nodes: 0 };
  const boxAt = (depth: number): Box | undefined => {
    const o = order[depth];
    return o ? candidatesFor(o.id)[chosen[depth] ?? -1]?.box : undefined;
  };
  let count = 0;
  let nodes = 0;
  let capped = false;
  let first: Placement[] | null = null;

  const recurse = (
    depth: number,
    occupied: number,
    fragileAbove: number,
    hotCells: number,
    coldCells: number
  ): void => {
    if (capped) return;
    if (depth === order.length) {
      count++;
      if (!first) {
        first = order.map((o, k) => {
          const cand = candidatesFor(o.id)[chosen[k] ?? 0];
          return {
            i: o.i,
            r: cand?.r ?? 0,
            c: cand?.c ?? 0,
            rot: cand?.rot ?? false,
          };
        });
      }
      if (count >= limit) capped = true;
      return;
    }
    const entry = order[depth];
    if (!entry) return;
    const prev = depth > 0 ? order[depth - 1] : undefined;
    const start =
      prev && prev.id === entry.id ? (chosen[depth - 1] ?? -1) + 1 : 0;
    const fragile = hasTag(entry.id, 'fragile');
    const hot = hasTag(entry.id, 'hot');
    const cold = hasTag(entry.id, 'cold');
    const list = candidatesFor(entry.id);

    for (let k = start; k < list.length; k++) {
      const cand = list[k];
      if (!cand) continue;
      if (++nodes > nodeLimit) {
        capped = true;
        return;
      }
      if (cand.mask & occupied) continue;
      if (cand.mask & fragileAbove) continue;
      if (fragile && cand.above & occupied) continue;
      if (hot && cand.neighbours & coldCells) continue;
      if (cold && cand.neighbours & hotCells) continue;
      if (request) {
        if (!pair && depth === depthX && !unaryOk(request.kind, cand.box))
          continue;
        if (pair && (depth === depthX || depth === depthY)) {
          const otherDepth = depth === depthX ? depthY : depthX;
          if (otherDepth < depth) {
            const otherBox = boxAt(otherDepth);
            if (otherBox) {
              const a = depth === depthX ? cand.box : otherBox;
              const b = depth === depthX ? otherBox : cand.box;
              if (!pairOk(request.kind, a, b)) continue;
            }
          }
        }
      }
      chosen[depth] = k;
      recurse(
        depth + 1,
        occupied | cand.mask,
        fragile ? fragileAbove | cand.above : fragileAbove,
        hot ? hotCells | cand.mask : hotCells,
        cold ? coldCells | cand.mask : coldCells
      );
      if (capped) return;
    }
    chosen[depth] = -1;
  };

  recurse(0, 0, 0, 0, 0);
  return { count, capped, first, nodes };
};

/** Counting stops here: past this many valid bags, more makes no difference. */
export const RATING_CAP = 4001;

/** Number of distinct valid bags, up to RATING_CAP. */
export const countSolutions = (
  items: readonly ItemId[],
  request: SpecialRequest | null = null
): number =>
  solve(items, { limit: RATING_CAP, nodeLimit: 3_000_000, request }).count;
