import { isItemId, itemCells } from './items';
import { isSpecialRequest, requestProblem, type SpecialRequest } from './requests';
import { RATING_CAP, rate } from './solver';
import type { Difficulty, ItemId } from './types';
import { GRID_CELLS } from './types';

/** Rules for community-written receipts ("Customer of the Day"). */
export const RECEIPT_LIMITS = {
  minItems: 6,
  maxItems: 10,
  maxCopies: 3,
  minCells: 15,
  minTitle: 3,
  maxTitle: 32,
  maxNote: 60,
} as const;

export type ReceiptDraft = {
  title: string;
  items: ItemId[];
  request: SpecialRequest | null;
  note: string;
};

export type ReceiptCheck =
  | {
      ok: true;
      title: string;
      items: ItemId[];
      difficulty: Difficulty;
      solutions: number;
      request: SpecialRequest;
      note: string | null;
    }
  | { ok: false; reason: string };

const BLOCKED = [
  'fuck',
  'shit',
  'cunt',
  'nigg',
  'fag',
  'retard',
  'bitch',
  'whore',
  'slut',
  'rape',
  'nazi',
  'hitler',
  'dick',
  'cock',
  'pussy',
  'porn',
  'penis',
  'vagina',
  'kill',
  'suicide',
];

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
};

export const normalizeTitle = (raw: string): string =>
  raw.replace(/\s+/g, ' ').trim();

/** Shared checks for any free text a player writes (receipt name, note). */
const textProblem = (title: string, what: string): string | null => {
  if (!/^[\p{L}\p{N} '’&!?,.:()-]+$/u.test(title))
    return 'Letters, numbers and simple punctuation only';
  if (/https?:|www\.|\.com|\b[ur]\//i.test(title))
    return `No links or mentions in ${what}`;
  const flat = title
    .toLowerCase()
    .split('')
    .map((ch) => LEET[ch] ?? ch)
    .join('')
    .replace(/[^a-z]/g, '');
  if (BLOCKED.some((word) => flat.includes(word)))
    return 'Keep it family friendly';
  return null;
};

export const titleProblem = (raw: string): string | null => {
  const title = normalizeTitle(raw);
  if (title.length < RECEIPT_LIMITS.minTitle) return 'Give your receipt a name';
  if (title.length > RECEIPT_LIMITS.maxTitle)
    return `Keep the name under ${RECEIPT_LIMITS.maxTitle} characters`;
  return textProblem(title, 'names');
};

/** The note is optional: an empty note is fine. */
export const noteProblem = (raw: string): string | null => {
  const note = normalizeTitle(raw);
  if (note.length === 0) return null;
  if (note.length > RECEIPT_LIMITS.maxNote)
    return `Keep the note under ${RECEIPT_LIMITS.maxNote} characters`;
  return textProblem(note, 'notes');
};

export const receiptCells = (items: readonly ItemId[]): number =>
  items.reduce((sum, id) => sum + itemCells(id), 0);

/** Full validation including the solver proof. Runs on the client for instant feedback and again on the server. */
/** Returned when everything is fine except that no request was picked yet. */
export const MISSING_REQUEST = 'Pick your special request';

export const checkReceipt = (draft: {
  title: unknown;
  items: unknown;
  request: unknown;
  note?: unknown;
}): ReceiptCheck => {
  if (typeof draft.title !== 'string')
    return { ok: false, reason: 'Give your receipt a name' };
  const problem = titleProblem(draft.title);
  if (problem) return { ok: false, reason: problem };
  if (!Array.isArray(draft.items) || !draft.items.every(isItemId)) {
    return { ok: false, reason: 'Unknown grocery item' };
  }
  const items: ItemId[] = [...draft.items];
  if (items.length < RECEIPT_LIMITS.minItems)
    return {
      ok: false,
      reason: `Add at least ${RECEIPT_LIMITS.minItems} items`,
    };
  if (items.length > RECEIPT_LIMITS.maxItems)
    return { ok: false, reason: `${RECEIPT_LIMITS.maxItems} items max` };
  const counts = new Map<ItemId, number>();
  for (const id of items) counts.set(id, (counts.get(id) ?? 0) + 1);
  if ([...counts.values()].some((n) => n > RECEIPT_LIMITS.maxCopies)) {
    return {
      ok: false,
      reason: `${RECEIPT_LIMITS.maxCopies} of the same item max`,
    };
  }
  const cells = receiptCells(items);
  if (cells > GRID_CELLS)
    return { ok: false, reason: 'That will never fit in one bag' };
  if (cells < RECEIPT_LIMITS.minCells)
    return { ok: false, reason: 'Too easy: fill more of the bag' };
  const base = rate(items);
  if (!base.solvable)
    return { ok: false, reason: 'Impossible bag: no way to pack this' };
  if (!isSpecialRequest(draft.request))
    return { ok: false, reason: MISSING_REQUEST };
  const request: SpecialRequest = { ...draft.request };
  const misfit = requestProblem(items, request);
  if (misfit) return { ok: false, reason: misfit };
  const rawNote = draft.note ?? '';
  if (typeof rawNote !== 'string') return { ok: false, reason: 'Invalid note' };
  const badNote = noteProblem(rawNote);
  if (badNote) return { ok: false, reason: badNote };

  const rating = rate(items, request);
  if (!rating.solvable)
    return { ok: false, reason: 'Your request makes this bag impossible' };
  if (base.solutions < RATING_CAP && rating.solutions >= base.solutions)
    return {
      ok: false,
      reason: 'Your request changes nothing: every bag already does that',
    };
  items.sort((a, b) => itemCells(b) - itemCells(a) || a.localeCompare(b));
  const note = normalizeTitle(rawNote);
  return {
    ok: true,
    title: normalizeTitle(draft.title),
    items,
    difficulty: rating.difficulty,
    solutions: rating.solutions,
    request,
    note: note.length > 0 ? note : null,
  };
};
