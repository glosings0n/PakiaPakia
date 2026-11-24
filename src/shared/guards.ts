import { isItemId } from './items';
import { isSpecialRequest } from './requests';
import type { DailyPostData, Puzzle } from './types';

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

export const isPuzzle = (v: unknown): v is Puzzle =>
  isObject(v) &&
  typeof v.title === 'string' &&
  (v.author === null || typeof v.author === 'string') &&
  Array.isArray(v.items) &&
  v.items.length > 0 &&
  v.items.every(isItemId) &&
  (v.difficulty === 'easy' ||
    v.difficulty === 'medium' ||
    v.difficulty === 'hard') &&
  (v.request === undefined || v.request === null || isSpecialRequest(v.request)) &&
  (v.note === undefined || v.note === null || typeof v.note === 'string');

export const isDailyPostData = (v: unknown): v is DailyPostData =>
  isObject(v) &&
  typeof v.day === 'string' &&
  typeof v.number === 'number' &&
  isPuzzle(v.puzzle);
