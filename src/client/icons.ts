/**
 * Single entry point for UI icons. Every icon comes from the free Hugeicons
 * stroke-rounded set and is rendered to an SVG string, so the React app and
 * the vanilla splash card share the exact same icons.
 */
import {
  ArrowUp01Icon,
  Cancel01Icon,
  ChartBarLineIcon,
  Comment01Icon,
  DrinkIcon,
  FireIcon,
  HelpCircleIcon,
  PencilEdit02Icon,
  ReceiptIcon,
  RotateClockwiseIcon,
  SnowIcon,
  Tick02Icon,
  Touch05Icon,
  UndoIcon,
  VolumeHighIcon,
  VolumeOffIcon,
  WeightIcon,
} from '@hugeicons/core-free-icons';

type IconData = readonly (readonly [
  string,
  Readonly<Record<string, string | number>>,
])[];

export const ICONS = {
  heavy: WeightIcon,
  fragile: DrinkIcon,
  cold: SnowIcon,
  hot: FireIcon,
  upright: ArrowUp01Icon,
  close: Cancel01Icon,
  check: Tick02Icon,
  vote: ArrowUp01Icon,
  rotate: RotateClockwiseIcon,
  undo: UndoIcon,
  soundOn: VolumeHighIcon,
  soundOff: VolumeOffIcon,
  help: HelpCircleIcon,
  receipt: ReceiptIcon,
  results: ChartBarLineIcon,
  write: PencilEdit02Icon,
  comment: Comment01Icon,
  tap: Touch05Icon,
  streak: FireIcon,
} as const satisfies Record<string, unknown>;

export type IconName = keyof typeof ICONS;

const attrName = (key: string) =>
  key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

const cache = new Map<string, string>();

/** SVG markup for an icon. Colour follows `currentColor`. */
export const iconMarkup = (
  name: IconName,
  size = 18,
  strokeWidth = 1.8
): string => {
  const key = `${name}:${size}:${strokeWidth}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const body = (ICONS[name] as unknown as IconData)
    .map(([tag, attrs]) => {
      const parts = Object.entries(attrs)
        .filter(([k]) => k !== 'key')
        .map(
          ([k, v]) =>
            `${attrName(k)}="${k === 'strokeWidth' ? strokeWidth : v}"`
        );
      return `<${tag} ${parts.join(' ')}/>`;
    })
    .join('');
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" aria-hidden="true">${body}</svg>`;
  cache.set(key, markup);
  return markup;
};
