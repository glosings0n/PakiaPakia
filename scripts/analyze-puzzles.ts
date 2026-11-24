/**
 * Prints how each house receipt is rated: valid bags and naive win rate
 * (see src/shared/difficulty.ts). Handy when tuning the generator.
 *
 * Run with: npm run analyze:puzzles
 */
import { rate } from '../src/shared/difficulty';
import { HOUSE_RECEIPTS } from '../src/shared/puzzles';

for (const r of HOUSE_RECEIPTS) {
  const rating = rate(r.items, r.request);
  console.log(
    `${r.day} ${r.difficulty.padEnd(6)} bags ${String(rating.solutions).padStart(5)} win ${(rating.winRate * 100).toFixed(1).padStart(5)}%  ${r.title} | ${r.request.kind}`
  );
}
