import { footprint, hasTag, ITEMS } from './items';
import { boxOf, pairOk, REQUEST_INFO, requestIndices, unaryOk } from './requests';
import type { Conflict, ItemId, Placement, Puzzle } from './types';
import { GRID_COLS, GRID_ROWS } from './types';

/**
 * Pure rule engine shared by the client (live feedback) and the server
 * (authoritative check before a solve is recorded).
 *
 * House rules:
 * - Heavy:       must rest on the floor of the bag (bottom row).
 * - Fragile:     nothing may sit anywhere above it in the same column.
 * - Temperature: cold and hot items may not touch side by side or top to bottom.
 * - Upright:     cannot be turned on its side.
 * Plus the receipt's optional special request (see requests.ts).
 */

export type BagCells = (number | null)[][];

export type Evaluation = {
  /** Structural problem that makes the layout impossible (overlap, out of bounds, bad data). */
  error: string | null;
  conflicts: Conflict[];
  placedCount: number;
  complete: boolean;
  solved: boolean;
};

export const cellsOf = (id: ItemId, p: Placement): [number, number][] => {
  const { w, h } = footprint(id, p.rot);
  const cells: [number, number][] = [];
  for (let dr = 0; dr < h; dr++) {
    for (let dc = 0; dc < w; dc++) cells.push([p.r + dr, p.c + dc]);
  }
  return cells;
};

export const inBounds = (id: ItemId, p: Placement): boolean => {
  const { w, h } = footprint(id, p.rot);
  return p.r >= 0 && p.c >= 0 && p.r + h <= GRID_ROWS && p.c + w <= GRID_COLS;
};

export const emptyBag = (): BagCells =>
  Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => null)
  );

/** Builds the occupancy grid. Returns null when items overlap or leave the bag. */
export const buildBag = (
  puzzle: Puzzle,
  placements: readonly Placement[]
): BagCells | null => {
  const bag = emptyBag();
  for (const p of placements) {
    const id = puzzle.items[p.i];
    if (!id || !inBounds(id, p)) return null;
    for (const [r, c] of cellsOf(id, p)) {
      const row = bag[r];
      if (!row || row[c] !== null) return null;
      row[c] = p.i;
    }
  }
  return bag;
};

/** Can this placement be dropped into the bag without overlapping or spilling out? */
export const fits = (
  puzzle: Puzzle,
  placements: readonly Placement[],
  candidate: Placement
): boolean => {
  const id = puzzle.items[candidate.i];
  if (!id || !inBounds(id, candidate)) return false;
  const others = placements.filter((p) => p.i !== candidate.i);
  const bag = buildBag(puzzle, others);
  if (!bag) return false;
  return cellsOf(id, candidate).every(([r, c]) => bag[r]?.[c] === null);
};

const at = (bag: BagCells, r: number, c: number): number | null =>
  bag[r]?.[c] ?? null;

export const findConflicts = (
  puzzle: Puzzle,
  placements: readonly Placement[]
): Conflict[] => {
  const bag = buildBag(puzzle, placements);
  if (!bag) return [];
  const conflicts: Conflict[] = [];
  const seenPairs = new Set<string>();

  for (const p of placements) {
    const id = puzzle.items[p.i];
    if (!id) continue;
    const { h } = footprint(id, p.rot);

    if (p.rot && hasTag(id, 'upright') && ITEMS[id].w !== ITEMS[id].h) {
      conflicts.push({ rule: 'upright', items: [p.i] });
    }

    if (hasTag(id, 'heavy') && p.r + h !== GRID_ROWS) {
      conflicts.push({ rule: 'heavy', items: [p.i] });
    }

    if (hasTag(id, 'fragile')) {
      const crushers = new Set<number>();
      for (const [r, c] of cellsOf(id, p)) {
        for (let above = r - 1; above >= 0; above--) {
          const other = at(bag, above, c);
          if (other !== null && other !== p.i) crushers.add(other);
        }
      }
      if (crushers.size > 0)
        conflicts.push({ rule: 'fragile', items: [p.i, ...crushers] });
    }

    if (hasTag(id, 'cold')) {
      const neighbours = new Set<number>();
      for (const [r, c] of cellsOf(id, p)) {
        for (const [nr, nc] of [
          [r - 1, c],
          [r + 1, c],
          [r, c - 1],
          [r, c + 1],
        ] as const) {
          const other = at(bag, nr, nc);
          if (other === null || other === p.i) continue;
          const otherId = puzzle.items[other];
          if (otherId && hasTag(otherId, 'hot')) neighbours.add(other);
        }
      }
      for (const other of neighbours) {
        const key = `${p.i}:${other}`;
        if (seenPairs.has(key)) continue;
        seenPairs.add(key);
        conflicts.push({ rule: 'temperature', items: [p.i, other] });
      }
    }
  }

  const broken = requestConflict(puzzle, placements);
  if (broken) conflicts.push(broken);
  return conflicts;
};

/** The special request, checked as soon as the items it names are in the bag. */
const requestConflict = (
  puzzle: Puzzle,
  placements: readonly Placement[]
): Conflict | null => {
  const request = puzzle.request;
  if (!request) return null;
  const { x, y } = requestIndices(puzzle.items, request);
  const px = placements.find((p) => p.i === x);
  if (!px) return null;
  const a = boxOf(request.item, px);
  if (!REQUEST_INFO[request.kind].pair) {
    return unaryOk(request.kind, a) ? null : { rule: 'request', items: [x] };
  }
  const py = placements.find((p) => p.i === y);
  if (!py || !request.other) return null;
  return pairOk(request.kind, a, boxOf(request.other, py))
    ? null
    : { rule: 'request', items: [x, y] };
};

export const evaluate = (
  puzzle: Puzzle,
  placements: readonly Placement[]
): Evaluation => {
  const seen = new Set<number>();
  for (const p of placements) {
    if (
      !Number.isInteger(p.i) ||
      !Number.isInteger(p.r) ||
      !Number.isInteger(p.c) ||
      typeof p.rot !== 'boolean' ||
      p.i < 0 ||
      p.i >= puzzle.items.length ||
      seen.has(p.i)
    ) {
      return {
        error: 'Invalid placement data',
        conflicts: [],
        placedCount: 0,
        complete: false,
        solved: false,
      };
    }
    seen.add(p.i);
  }
  const bag = buildBag(puzzle, placements);
  if (!bag) {
    return {
      error: 'Items overlap or leave the bag',
      conflicts: [],
      placedCount: placements.length,
      complete: false,
      solved: false,
    };
  }
  const conflicts = findConflicts(puzzle, placements);
  const complete = placements.length === puzzle.items.length;
  return {
    error: null,
    conflicts,
    placedCount: placements.length,
    complete,
    solved: complete && conflicts.length === 0,
  };
};

/**
 * Canonical, order-independent signature of a finished bag: one character per
 * cell holding the item type letter. Two players with the same visual bag share
 * the same signature even if they swapped identical items.
 */
export const bagSignature = (
  puzzle: Puzzle,
  placements: readonly Placement[]
): string => {
  const bag = buildBag(puzzle, placements);
  if (!bag) return '';
  const letters = Object.keys(ITEMS);
  return bag
    .flat()
    .map((cell) => {
      if (cell === null) return '.';
      const id = puzzle.items[cell];
      const index = id ? letters.indexOf(id) : -1;
      return index >= 0 ? String.fromCharCode(65 + index) : '?';
    })
    .join('');
};
