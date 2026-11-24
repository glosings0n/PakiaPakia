import { footprint, isItemId, ITEMS } from './items';
import type { ItemId, Placement } from './types';
import { GRID_COLS, GRID_ROWS } from './types';

/**
 * "Special requests": one extra rule per receipt, picked by the customer who
 * wrote it. A request always names items that appear exactly once on the
 * receipt, so there is never any doubt about which item it is about.
 */

export const REQUEST_KINDS = [
  'top',
  'offFloor',
  'middle',
  'apart',
  'together',
  'above',
] as const;

export type RequestKind = (typeof REQUEST_KINDS)[number];

export type SpecialRequest = {
  kind: RequestKind;
  item: ItemId;
  /** Second item, for the requests that compare two items. */
  other?: ItemId;
};

export const REQUEST_INFO: Record<
  RequestKind,
  { label: string; pair: boolean; help: string }
> = {
  top: {
    label: 'Top row',
    pair: false,
    help: 'The item touches the top of the bag.',
  },
  offFloor: {
    label: 'Off the floor',
    pair: false,
    help: 'The item does not touch the floor of the bag.',
  },
  middle: {
    label: 'In the middle',
    pair: false,
    help: 'The item covers the center square of the bag.',
  },
  apart: {
    label: 'Away from',
    pair: true,
    help: 'The two items do not share a side.',
  },
  together: {
    label: 'Next to',
    pair: true,
    help: 'The two items share a side.',
  },
  above: {
    label: 'Above',
    pair: true,
    help: 'The first item sits entirely higher than the second one.',
  },
};

export const isRequestKind = (v: unknown): v is RequestKind =>
  typeof v === 'string' && (REQUEST_KINDS as readonly string[]).includes(v);

export const isSpecialRequest = (v: unknown): v is SpecialRequest => {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  if (!isRequestKind(r.kind) || !isItemId(r.item)) return false;
  if (REQUEST_INFO[r.kind].pair) return isItemId(r.other) && r.other !== r.item;
  return r.other === undefined;
};

const lower = (id: ItemId) => ITEMS[id].name.toLowerCase();

/** One plain sentence, written as the customer would say it. */
export const describeRequest = (request: SpecialRequest): string => {
  const x = lower(request.item);
  const y = request.other ? lower(request.other) : 'other item';
  switch (request.kind) {
    case 'top':
      return `Put the ${x} on the top row.`;
    case 'offFloor':
      return `Keep the ${x} off the floor.`;
    case 'middle':
      return `The ${x} goes in the middle.`;
    case 'apart':
      return `Keep the ${x} away from the ${y}.`;
    case 'together':
      return `The ${x} must touch the ${y}.`;
    case 'above':
      return `The ${x} goes above the ${y}.`;
  }
};

/** Why a request cannot be used with these items, or null when it can. */
export const requestProblem = (
  items: readonly ItemId[],
  request: SpecialRequest
): string | null => {
  const count = (id: ItemId) => items.filter((x) => x === id).length;
  if (count(request.item) !== 1)
    return 'Pick an item that is on the receipt once';
  if (REQUEST_INFO[request.kind].pair) {
    if (!request.other) return 'Pick a second item';
    if (request.other === request.item) return 'Pick two different items';
    if (count(request.other) !== 1)
      return 'Pick a second item that is on the receipt once';
  }
  return null;
};

/** Index of each item named by the request, or -1 when missing. */
export const requestIndices = (
  items: readonly ItemId[],
  request: SpecialRequest
): { x: number; y: number } => ({
  x: items.indexOf(request.item),
  y: request.other ? items.indexOf(request.other) : -1,
});

/* ---------- Geometry ---------- */

export type Box = { top: number; bottom: number; left: number; right: number };

export const boxOf = (id: ItemId, p: Placement): Box => {
  const { w, h } = footprint(id, p.rot);
  return { top: p.r, bottom: p.r + h - 1, left: p.c, right: p.c + w - 1 };
};

const CENTER_ROW = Math.floor(GRID_ROWS / 2);
const CENTER_COL = Math.floor(GRID_COLS / 2);

/** Whether a single item already satisfies a one-item request. */
export const unaryOk = (kind: RequestKind, box: Box): boolean => {
  switch (kind) {
    case 'top':
      return box.top === 0;
    case 'offFloor':
      return box.bottom < GRID_ROWS - 1;
    case 'middle':
      return (
        box.top <= CENTER_ROW &&
        box.bottom >= CENTER_ROW &&
        box.left <= CENTER_COL &&
        box.right >= CENTER_COL
      );
    default:
      return true;
  }
};

/** Two boxes share a side (orthogonal contact, no overlap). */
export const touching = (a: Box, b: Box): boolean => {
  const rowsOverlap = a.top <= b.bottom && b.top <= a.bottom;
  const colsOverlap = a.left <= b.right && b.left <= a.right;
  const sideBySide = rowsOverlap && (a.right + 1 === b.left || b.right + 1 === a.left);
  const stacked = colsOverlap && (a.bottom + 1 === b.top || b.bottom + 1 === a.top);
  return sideBySide || stacked;
};

/** Whether two placed items satisfy a two-item request. `a` is the request's first item. */
export const pairOk = (kind: RequestKind, a: Box, b: Box): boolean => {
  switch (kind) {
    case 'apart':
      return !touching(a, b);
    case 'together':
      return touching(a, b);
    case 'above':
      return a.bottom < b.top;
    default:
      return true;
  }
};
