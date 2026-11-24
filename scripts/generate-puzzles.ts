/**
 * Generates the house receipt pool in src/shared/puzzles.ts.
 *
 * Every receipt is proven solvable by the exhaustive solver and rated by its
 * number of valid bags. Difficulty follows a weekly curve:
 * Mon/Tue easy, Wed/Thu/Sun medium, Fri/Sat hard.
 *
 * Run with: npm run generate:puzzles
 */
import { writeFileSync } from 'node:fs';
import { addDays, weekday } from '../src/shared/dates';
import { ITEM_IDS, itemCells } from '../src/shared/items';
import { rate } from '../src/shared/solver';
import type { Difficulty, ItemId } from '../src/shared/types';

const FIRST_DAY = '2026-11-20';
const LAST_DAY = '2027-02-28';

const THEMES: { title: string; pool: ItemId[] }[] = [
  { title: 'Sunday roast', pool: ['chicken', 'peas', 'wine', 'bread', 'tomatoes', 'rice', 'apples', 'pie', 'milk', 'soup'] },
  { title: 'Movie night', pool: ['pizza', 'chips', 'icecream', 'wine', 'cheese', 'apples', 'coffee', 'cereal', 'water'] },
  { title: 'Birthday party', pool: ['cake', 'chips', 'icecream', 'pizza', 'wine', 'water', 'apples', 'eggs', 'milk'] },
  { title: 'Brunch for two', pool: ['eggs', 'bread', 'coffee', 'milk', 'cheese', 'tomatoes', 'baguette', 'apples', 'fish'] },
  { title: 'Bake sale', pool: ['eggs', 'milk', 'cake', 'pie', 'bread', 'baguette', 'apples', 'cereal', 'rice'] },
  { title: 'Leftover feast', pool: ['turkey', 'pie', 'bread', 'peas', 'wine', 'apples', 'rice', 'soup', 'tomatoes'] },
  { title: 'Picnic in the park', pool: ['baguette', 'cheese', 'wine', 'apples', 'chips', 'tomatoes', 'water', 'chicken', 'watermelon'] },
  { title: 'Student budget', pool: ['soup', 'rice', 'cereal', 'milk', 'peas', 'apples', 'chips', 'coffee', 'bread'] },
  { title: 'Fish Friday', pool: ['fish', 'peas', 'tomatoes', 'bread', 'wine', 'rice', 'cheese', 'apples', 'chips'] },
  { title: 'Gym week', pool: ['water', 'rice', 'eggs', 'fish', 'chicken', 'apples', 'milk', 'peas', 'cereal'] },
  { title: 'Hosting the in-laws', pool: ['turkey', 'wine', 'cake', 'cheese', 'bread', 'pie', 'towels', 'coffee', 'detergent'] },
  { title: 'Laundry day', pool: ['detergent', 'towels', 'water', 'soup', 'cereal', 'coffee', 'chips', 'apples', 'milk'] },
  { title: 'Snow day', pool: ['soup', 'coffee', 'milk', 'bread', 'cheese', 'eggs', 'rice', 'peas', 'cereal', 'icecream'] },
  { title: 'Pizza party', pool: ['pizza', 'chips', 'water', 'icecream', 'cheese', 'tomatoes', 'wine', 'apples'] },
  { title: 'Backyard BBQ', pool: ['watermelon', 'chicken', 'icecream', 'water', 'tomatoes', 'chips', 'bread', 'cheese'] },
  { title: 'Big family shop', pool: ['watermelon', 'milk', 'eggs', 'bread', 'cereal', 'towels', 'detergent', 'apples', 'soup', 'peas'] },
  { title: 'Midnight snack', pool: ['icecream', 'chips', 'cheese', 'pie', 'apples', 'milk', 'coffee', 'cereal'] },
  { title: 'Holiday dinner', pool: ['turkey', 'wine', 'pie', 'cake', 'peas', 'bread', 'tomatoes', 'cheese', 'coffee'] },
  { title: 'Fresh start', pool: ['apples', 'tomatoes', 'water', 'eggs', 'fish', 'peas', 'milk', 'rice'] },
  { title: 'Game day', pool: ['pizza', 'chips', 'chicken', 'water', 'wine', 'icecream', 'cheese', 'soup'] },
  { title: 'Cozy soup night', pool: ['soup', 'bread', 'baguette', 'cheese', 'tomatoes', 'coffee', 'rice', 'peas', 'milk'] },
  { title: 'Spring cleaning', pool: ['detergent', 'towels', 'water', 'apples', 'coffee', 'chips', 'soup', 'cereal'] },
  { title: 'Breakfast in bed', pool: ['eggs', 'coffee', 'milk', 'cereal', 'bread', 'apples', 'cheese', 'tomatoes', 'pie'] },
  { title: 'Dinner party', pool: ['fish', 'wine', 'cheese', 'baguette', 'tomatoes', 'cake', 'peas', 'pie', 'coffee'] },
  { title: 'Camping trip', pool: ['water', 'soup', 'chips', 'apples', 'coffee', 'bread', 'rice', 'eggs', 'towels'] },
  { title: 'Party for one', pool: ['wine', 'cheese', 'cake', 'chips', 'icecream', 'baguette', 'fish', 'water', 'pizza'] },
  { title: 'Sick day', pool: ['soup', 'tomatoes', 'apples', 'water', 'towels', 'coffee', 'bread', 'milk', 'icecream'] },
  { title: 'Taco Tuesday', pool: ['chicken', 'tomatoes', 'cheese', 'chips', 'rice', 'water', 'peas', 'icecream'] },
];

const TARGETS: Record<Difficulty, { minCells: number; maxCells: number; minItems: number; maxItems: number; minSolutions: number; maxSolutions: number }> = {
  easy: { minCells: 19, maxCells: 22, minItems: 8, maxItems: 9, minSolutions: 4001, maxSolutions: Number.POSITIVE_INFINITY },
  medium: { minCells: 21, maxCells: 24, minItems: 9, maxItems: 10, minSolutions: 251, maxSolutions: 4000 },
  hard: { minCells: 23, maxCells: 25, minItems: 8, maxItems: 10, minSolutions: 2, maxSolutions: 250 },
};

const difficultyFor = (day: string): Difficulty => {
  const wd = weekday(day);
  if (wd === 1 || wd === 2) return 'easy';
  if (wd === 5 || wd === 6) return 'hard';
  return 'medium';
};

const makeRng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

type Entry = { day: string; title: string; items: ItemId[]; difficulty: Difficulty; solutions: number };

const entries: Entry[] = [];
const recentTitles: string[] = [];
for (let day = FIRST_DAY, n = 0; day <= LAST_DAY; day = addDays(day, 1), n++) {
  const difficulty = difficultyFor(day);
  const target = TARGETS[difficulty];
  const rng = makeRng(20261120 + n * 7919);
  let found: Entry | null = null;
  for (let attempt = 0; attempt < 20000 && !found; attempt++) {
    const fresh = THEMES.filter((t) => !recentTitles.includes(t.title));
    const theme = fresh[Math.floor(rng() * fresh.length)];
    if (!theme) break;
    const count = target.minItems + Math.floor(rng() * (target.maxItems - target.minItems + 1));
    const items: ItemId[] = [];
    while (items.length < count) {
      // Mostly on-theme groceries, plus the odd impulse buy from the whole catalog.
      const source = rng() < 0.8 ? theme.pool : ITEM_IDS;
      const pick = source[Math.floor(rng() * source.length)];
      if (pick && items.filter((x) => x === pick).length < 2) items.push(pick);
    }
    const cells = items.reduce((sum, id) => sum + itemCells(id), 0);
    if (cells < target.minCells || cells > target.maxCells) continue;
    const rating = rate(items);
    if (!rating.solvable || rating.difficulty !== difficulty) continue;
    if (rating.solutions < target.minSolutions || rating.solutions > target.maxSolutions) continue;
    items.sort((a, b) => itemCells(b) - itemCells(a) || a.localeCompare(b));
    found = { day, title: theme.title, items, difficulty, solutions: rating.solutions };
    recentTitles.push(theme.title);
    if (recentTitles.length > 14) recentTitles.shift();
  }
  if (!found) throw new Error(`Could not generate a ${difficulty} receipt for ${day}`);
  entries.push(found);
  console.log(`${day} ${difficulty.padEnd(6)} ${String(found.solutions).padStart(5)} ${found.title}`);
}

const body = entries
  .map(
    (e) =>
      `  { day: '${e.day}', title: '${e.title.replace(/'/g, "\\'")}', difficulty: '${e.difficulty}', items: [${e.items
        .map((i) => `'${i}'`)
        .join(', ')}] },`
  )
  .join('\n');

const file = `// Generated by scripts/generate-puzzles.ts. Do not edit by hand.
// Every receipt below was proven solvable by src/shared/solver.ts and is re-checked by
// src/shared/puzzles.test.ts. Difficulty: Mon/Tue easy, Wed/Thu/Sun medium, Fri/Sat hard.
import { dayNumber } from './dates';
import type { Difficulty, ItemId, Puzzle } from './types';

export type HouseReceipt = { day: string; title: string; difficulty: Difficulty; items: ItemId[] };

export const HOUSE_RECEIPTS: HouseReceipt[] = [
${body}
];

/**
 * The house receipt for a given day. Days outside the generated range cycle
 * through the pool so a solvable puzzle is always available.
 */
export const houseReceiptFor = (day: string): Puzzle => {
  const exact = HOUSE_RECEIPTS.find((r) => r.day === day);
  const fallbackIndex =
    ((dayNumber(day) - 1) % HOUSE_RECEIPTS.length + HOUSE_RECEIPTS.length) % HOUSE_RECEIPTS.length;
  const receipt = exact ?? HOUSE_RECEIPTS[fallbackIndex] ?? HOUSE_RECEIPTS[0];
  if (!receipt) throw new Error('House receipt pool is empty');
  return { title: receipt.title, author: null, items: [...receipt.items], difficulty: receipt.difficulty };
};
`;

writeFileSync(new URL('../src/shared/puzzles.ts', import.meta.url), file);
console.log(`\nWrote ${entries.length} receipts.`);
