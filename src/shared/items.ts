import type { ItemDef, ItemId } from './types';

const def = (
  id: ItemId,
  name: string,
  w: number,
  h: number,
  tags: ItemDef['tags'] = []
): ItemDef => ({ id, name, w, h, tags });

/** The grocery catalog. Shapes are given in their natural orientation (w x h). */
export const ITEMS: Record<ItemId, ItemDef> = {
  watermelon: def('watermelon', 'Watermelon', 2, 2, ['heavy']),
  turkey: def('turkey', 'Frozen turkey', 2, 2, ['heavy', 'cold']),
  pizza: def('pizza', 'Hot pizza', 2, 2, ['hot']),
  cake: def('cake', 'Birthday cake', 2, 2, ['fragile']),
  water: def('water', 'Water pack', 2, 1, ['heavy']),
  rice: def('rice', 'Rice sack', 1, 2, ['heavy']),
  soup: def('soup', 'Canned soup', 1, 1, ['heavy']),
  detergent: def('detergent', 'Detergent', 1, 2, ['heavy', 'upright']),
  milk: def('milk', 'Milk', 1, 2, ['cold', 'upright']),
  wine: def('wine', 'Wine', 1, 2, ['fragile', 'upright']),
  cereal: def('cereal', 'Cereal', 1, 2, ['upright']),
  towels: def('towels', 'Paper towels', 1, 3, ['upright']),
  baguette: def('baguette', 'Baguette', 3, 1, ['fragile']),
  eggs: def('eggs', 'Eggs', 2, 1, ['fragile']),
  bread: def('bread', 'Bread', 2, 1, ['fragile']),
  chips: def('chips', 'Chips', 1, 1, ['fragile']),
  tomatoes: def('tomatoes', 'Tomatoes', 1, 1, ['fragile']),
  pie: def('pie', 'Fresh pie', 2, 1, ['hot', 'fragile']),
  chicken: def('chicken', 'Roast chicken', 2, 1, ['hot']),
  coffee: def('coffee', 'Hot coffee', 1, 1, ['hot']),
  icecream: def('icecream', 'Ice cream', 1, 1, ['cold']),
  cheese: def('cheese', 'Cheese', 1, 1, ['cold']),
  peas: def('peas', 'Frozen peas', 1, 1, ['cold']),
  fish: def('fish', 'Fresh fish', 2, 1, ['cold']),
  apples: def('apples', 'Apples', 1, 1),
};

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

export const isItemId = (value: unknown): value is ItemId =>
  typeof value === 'string' && Object.hasOwn(ITEMS, value);

export const itemCells = (id: ItemId): number => ITEMS[id].w * ITEMS[id].h;

/** Width and height of an item, taking rotation into account. */
export const footprint = (
  id: ItemId,
  rot: boolean
): { w: number; h: number } => {
  const item = ITEMS[id];
  return rot ? { w: item.h, h: item.w } : { w: item.w, h: item.h };
};

/** Whether rotating this item changes anything and is allowed. */
export const canRotate = (id: ItemId): boolean => {
  const item = ITEMS[id];
  return item.w !== item.h && !item.tags.includes('upright');
};

export const hasTag = (id: ItemId, tag: ItemDef['tags'][number]): boolean =>
  ITEMS[id].tags.includes(tag);
