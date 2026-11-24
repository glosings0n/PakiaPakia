import type { CommunityBag } from './api';
import { ITEMS } from './items';
import type { ItemId } from './types';

/** One packed item and the exact cells it covers. */
export type Footprint = { item: ItemId; field: string; size: number };

/**
 * Footprints of every packed item, from the flat bag (instance index per cell).
 * The field ("milk@7.12") is the Redis hash field counting players who used the same spot.
 */
export const footprints = (
  items: readonly ItemId[],
  bag: readonly (number | null)[]
): Footprint[] => {
  const byInstance = new Map<number, number[]>();
  bag.forEach((instance, cell) => {
    if (instance === null) return;
    const cells = byInstance.get(instance) ?? [];
    cells.push(cell);
    byInstance.set(instance, cells);
  });
  const out: Footprint[] = [];
  for (const [instance, cells] of byInstance) {
    const item = items[instance];
    if (!item) continue;
    out.push({ item, field: `${item}@${cells.join('.')}`, size: cells.length });
  }
  return out;
};

/** Share of the other solvers, as a whole percentage that never rounds a real count down to 0. */
const share = (count: number, others: number): number => {
  if (count <= 0) return 0;
  if (count >= others) return 100;
  return Math.min(99, Math.max(1, Math.round((count / others) * 100)));
};

export type Reveal = { headline: string; detail: string | null };

const itemName = (id: ItemId): string => {
  const name = ITEMS[id].name;
  return name.charAt(0).toLowerCase() + name.slice(1);
};

/**
 * How unusual the player's bag is, compared with everyone else who packed it today.
 * Null while nobody else has solved.
 */
export const revealFor = (community: CommunityBag): Reveal | null => {
  const others = community.totalBags - 1;
  if (others < 1) return null;
  const same = share(community.sameBagCount - 1, others);
  const headline =
    same === 0
      ? 'Nobody packed it like you'
      : same === 100
        ? 'Everyone packed it just like you'
        : same < 50
          ? `Only ${same}% packed it like you`
          : `${same}% packed it just like you`;
  const rare = community.rareSpot;
  let detail: string | null = null;
  if (rare) {
    const pct = share(rare.others, others);
    const name = itemName(rare.item);
    if (pct === 0) detail = `Nobody else put the ${name} where you did.`;
    else if (pct < 50) detail = `Only ${pct}% put the ${name} where you did.`;
    else if (same < 100)
      detail = 'Every item sits where most baggers put it.';
  }
  return { headline, detail };
};
