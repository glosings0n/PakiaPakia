/** Daily puzzles roll over at 00:00 UTC. Days are keyed as YYYY-MM-DD strings. */

/** Bag #1 was packed on this day. */
export const LAUNCH_DAY = '2026-11-20';

const DAY_MS = 86_400_000;

export const dayKey = (date: Date = new Date()): string =>
  date.toISOString().slice(0, 10);

export const parseDay = (day: string): Date => new Date(`${day}T00:00:00.000Z`);

export const isDayKey = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(parseDay(value).getTime());

export const addDays = (day: string, delta: number): string =>
  dayKey(new Date(parseDay(day).getTime() + delta * DAY_MS));

export const dayNumber = (day: string): number =>
  Math.round(
    (parseDay(day).getTime() - parseDay(LAUNCH_DAY).getTime()) / DAY_MS
  ) + 1;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** e.g. "Wed, Dec 9" */
export const formatDay = (day: string): string => {
  const d = parseDay(day);
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
};

/** 0 = Sunday ... 6 = Saturday */
export const weekday = (day: string): number => parseDay(day).getUTCDay();

/** Milliseconds until the next 00:00 UTC rollover. */
export const msUntilNextDay = (now: Date = new Date()): number => {
  const next = parseDay(addDays(dayKey(now), 1)).getTime();
  return next - now.getTime();
};

export const formatDuration = (ms: number): string => {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};
