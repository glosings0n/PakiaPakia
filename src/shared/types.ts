import type { SpecialRequest } from './requests';

/** Bag dimensions. Row 0 is the top of the bag, row GRID_ROWS - 1 is the floor. */
export const GRID_COLS = 5;
export const GRID_ROWS = 5;
export const GRID_CELLS = GRID_COLS * GRID_ROWS;

export type Tag = 'heavy' | 'fragile' | 'cold' | 'hot' | 'upright';

export type ItemId =
  | 'watermelon'
  | 'turkey'
  | 'pizza'
  | 'cake'
  | 'water'
  | 'rice'
  | 'soup'
  | 'detergent'
  | 'milk'
  | 'wine'
  | 'cereal'
  | 'towels'
  | 'baguette'
  | 'eggs'
  | 'bread'
  | 'chips'
  | 'tomatoes'
  | 'pie'
  | 'chicken'
  | 'coffee'
  | 'icecream'
  | 'cheese'
  | 'peas'
  | 'fish'
  | 'apples';

export type ItemDef = {
  id: ItemId;
  name: string;
  /** Width in cells, in the item's natural orientation. */
  w: number;
  /** Height in cells, in the item's natural orientation. */
  h: number;
  tags: readonly Tag[];
};

export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

/** A receipt: the list of groceries that must fit in the bag. */
export type Puzzle = {
  title: string;
  /** Reddit username of the community member who wrote the receipt, or null for house receipts. */
  author: string | null;
  items: ItemId[];
  difficulty: Difficulty;
  /** The customer's special request: one extra rule for this receipt. */
  request?: SpecialRequest | null;
  /** Optional handwritten note from the customer who wrote the receipt. */
  note?: string | null;
};

/** One item instance placed in the bag. `i` indexes into `Puzzle.items`. */
export type Placement = {
  i: number;
  r: number;
  c: number;
  rot: boolean;
};

export type RuleId = 'heavy' | 'fragile' | 'temperature' | 'upright' | 'request';

export type Conflict = {
  rule: RuleId;
  /** Item instance indices involved. The first one is the item breaking its own rule. */
  items: number[];
};

/** Data stored on each daily post (Devvit postData, limited to 2 KB). */
export type DailyPostData = {
  day: string;
  number: number;
  puzzle: Puzzle;
};
