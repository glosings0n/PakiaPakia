import { redis } from '@devvit/web/server';
import type { CommunityBag, LeaderRow, ReceiptCandidate } from '../shared/api';
import { addDays } from '../shared/dates';
import { isItemId, ITEM_IDS } from '../shared/items';
import type {
  DailyPostData,
  Difficulty,
  ItemId,
  Placement,
  Puzzle,
} from '../shared/types';
import { GRID_CELLS } from '../shared/types';
import { isDailyPostData, isPuzzle } from '../shared/guards';
import type { SpecialRequest } from '../shared/requests';

/** All Redis keys in one place. Day keys are YYYY-MM-DD (UTC). */
export const keys = {
  post: (postId: string) => `post:${postId}`,
  dayPost: (day: string) => `day:${day}:post`,
  dayPuzzle: (day: string) => `day:${day}:puzzle`,
  opened: (day: string) => `opened:${day}`,
  solves: (day: string) => `solves:${day}`,
  leaderboard: (day: string) => `lb:${day}`,
  signatures: (day: string) => `sig:${day}`,
  cells: (day: string) => `cells:${day}`,
  user: (userId: string) => `user:${userId}`,
  shared: (day: string) => `shared:${day}`,
  receipt: (id: string) => `receipt:${id}`,
  receiptSeq: () => 'receipt:seq',
  pendingReceipts: () => 'receipts:pending',
  vote: (day: string, userId: string) => `vote:${day}:${userId}`,
  submitted: (day: string) => `submitted:${day}`,
};

const DAY_SECONDS = 86_400;

const parseJson = <T>(
  raw: string | undefined | null,
  guard: (v: unknown) => v is T
): T | null => {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return guard(value) ? value : null;
  } catch {
    return null;
  }
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

export { isDailyPostData, isPuzzle };

/* ---------- Daily posts ---------- */

export const getPostData = async (
  postId: string
): Promise<DailyPostData | null> =>
  parseJson(await redis.get(keys.post(postId)), isDailyPostData);

export const savePostData = async (
  postId: string,
  data: DailyPostData
): Promise<void> => {
  await redis.set(keys.post(postId), JSON.stringify(data));
};

export const getDayPuzzle = async (day: string): Promise<Puzzle | null> =>
  parseJson(await redis.get(keys.dayPuzzle(day)), isPuzzle);

export const setDayPuzzle = async (
  day: string,
  puzzle: Puzzle
): Promise<void> => {
  await redis.set(keys.dayPuzzle(day), JSON.stringify(puzzle));
};

export const getDayPostId = async (day: string): Promise<string | null> =>
  (await redis.get(keys.dayPost(day))) ?? null;

export const setDayPostId = async (
  day: string,
  postId: string
): Promise<void> => {
  await redis.set(keys.dayPost(day), postId);
};

/* ---------- Timing ---------- */

export const markOpened = async (
  day: string,
  userId: string
): Promise<void> => {
  const created = await redis.hSetNX(
    keys.opened(day),
    userId,
    String(Date.now())
  );
  if (created) await redis.expire(keys.opened(day), 3 * DAY_SECONDS);
};

export const getOpened = async (
  day: string,
  userId: string
): Promise<number | null> => {
  const raw = await redis.hGet(keys.opened(day), userId);
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) ? value : null;
};

/* ---------- Solves ---------- */

export type StoredSolve = {
  timeMs: number;
  moves: number;
  placements: Placement[];
  signature: string;
  at: number;
};

const isStoredSolve = (v: unknown): v is StoredSolve =>
  isObject(v) &&
  typeof v.timeMs === 'number' &&
  typeof v.moves === 'number' &&
  Array.isArray(v.placements) &&
  typeof v.signature === 'string';

export const getSolve = async (
  day: string,
  userId: string
): Promise<StoredSolve | null> =>
  parseJson(await redis.hGet(keys.solves(day), userId), isStoredSolve);

/** Leaderboard score: time first, moves as the tie-breaker. Lower is better. */
const lbScore = (timeMs: number, moves: number): number =>
  timeMs * 1000 + Math.min(moves, 999);
const decodeScore = (score: number): { timeMs: number; moves: number } => ({
  timeMs: Math.floor(score / 1000),
  moves: Math.round(score % 1000),
});

/** Records a first solve. Returns false if the player had already solved this day. */
export const recordSolve = async (
  day: string,
  userId: string,
  solve: StoredSolve,
  puzzle: Puzzle,
  bag: (number | null)[]
): Promise<boolean> => {
  const created = await redis.hSetNX(
    keys.solves(day),
    userId,
    JSON.stringify(solve)
  );
  if (created !== 1) return false;
  await redis.zAdd(keys.leaderboard(day), {
    member: userId,
    score: lbScore(solve.timeMs, solve.moves),
  });
  await redis.zIncrBy(keys.signatures(day), solve.signature, 1);
  const increments: Promise<number>[] = [];
  bag.forEach((instance, cell) => {
    const id = instance === null ? undefined : puzzle.items[instance];
    if (id) increments.push(redis.hIncrBy(keys.cells(day), `${cell}:${id}`, 1));
  });
  await Promise.all(increments);
  return true;
};

export const solveCount = async (day: string): Promise<number> =>
  redis.zCard(keys.leaderboard(day));

/* ---------- Users and streaks ---------- */

export type StoredUser = {
  name: string;
  avatar: string;
  streak: number;
  maxStreak: number;
  lastDay: string;
  solved: number;
};

export const getUser = async (userId: string): Promise<StoredUser> => {
  const raw = await redis.hGetAll(keys.user(userId));
  return {
    name: raw.name ?? '',
    avatar: raw.avatar ?? '',
    streak: Number(raw.streak ?? 0) || 0,
    maxStreak: Number(raw.maxStreak ?? 0) || 0,
    lastDay: raw.lastDay ?? '',
    solved: Number(raw.solved ?? 0) || 0,
  };
};

/** A streak only survives if yesterday's bag was packed too. */
export const effectiveStreak = (user: StoredUser, today: string): number =>
  user.lastDay === today || user.lastDay === addDays(today, -1)
    ? user.streak
    : 0;

export const updateUserAfterSolve = async (
  userId: string,
  profile: { name: string; avatar: string },
  solvedDay: string,
  today: string
): Promise<StoredUser> => {
  const user = await getUser(userId);
  const next: StoredUser = {
    ...user,
    name: profile.name || user.name,
    avatar: profile.avatar || user.avatar,
    solved: user.solved + 1,
  };
  if (solvedDay === today && user.lastDay !== today) {
    next.streak = user.lastDay === addDays(today, -1) ? user.streak + 1 : 1;
    next.maxStreak = Math.max(user.maxStreak, next.streak);
    next.lastDay = today;
  }
  await redis.hSet(keys.user(userId), {
    name: next.name,
    avatar: next.avatar,
    streak: String(next.streak),
    maxStreak: String(next.maxStreak),
    lastDay: next.lastDay,
    solved: String(next.solved),
  });
  return next;
};

/* ---------- Leaderboard ---------- */

export const getRank = async (
  day: string,
  userId: string
): Promise<number | null> => {
  const rank = await redis.zRank(keys.leaderboard(day), userId);
  return rank === undefined ? null : rank + 1;
};

export const getLeaderboard = async (
  day: string,
  me: string | undefined,
  size = 10
): Promise<LeaderRow[]> => {
  const rows = await redis.zRange(keys.leaderboard(day), 0, size - 1, {
    by: 'rank',
  });
  const users = await Promise.all(rows.map((row) => getUser(row.member)));
  return rows.map((row, index) => {
    const user = users[index];
    const { timeMs, moves } = decodeScore(row.score);
    return {
      rank: index + 1,
      username: user?.name || 'anonymous',
      avatar: user?.avatar || null,
      timeMs,
      moves,
      me: row.member === me,
    };
  });
};

/* ---------- Community bag ---------- */

export const getCommunityBag = async (
  day: string,
  signature: string,
  mine: (ItemId | null)[]
): Promise<CommunityBag> => {
  const [counts, sameBag, totalBags] = await Promise.all([
    redis.hGetAll(keys.cells(day)),
    redis.zScore(keys.signatures(day), signature),
    redis.zCard(keys.leaderboard(day)),
  ]);
  const best: { id: ItemId | null; n: number }[] = Array.from(
    { length: GRID_CELLS },
    () => ({ id: null, n: 0 })
  );
  for (const [field, value] of Object.entries(counts)) {
    const [cellRaw, id] = field.split(':');
    const cell = Number(cellRaw);
    const n = Number(value);
    const slot = best[cell];
    if (!slot || !isItemId(id)) continue;
    if (
      n > slot.n ||
      (n === slot.n &&
        slot.id !== null &&
        ITEM_IDS.indexOf(id) < ITEM_IDS.indexOf(slot.id))
    ) {
      slot.id = id;
      slot.n = n;
    }
  }
  const cells = best.map((b) => b.id);
  let filled = 0;
  let matches = 0;
  mine.forEach((id, cell) => {
    if (!id) return;
    filled++;
    if (cells[cell] === id) matches++;
  });
  return {
    cells,
    matchPct: filled ? Math.round((matches / filled) * 100) : 0,
    sameBagCount: sameBag ?? 1,
    totalBags,
  };
};

/* ---------- Sharing ---------- */

export const markShared = async (
  day: string,
  userId: string
): Promise<boolean> =>
  (await redis.hSetNX(keys.shared(day), userId, '1')) === 1;

export const unmarkShared = async (
  day: string,
  userId: string
): Promise<void> => {
  await redis.hDel(keys.shared(day), [userId]);
};

export const hasShared = async (
  day: string,
  userId: string
): Promise<boolean> => Boolean(await redis.hGet(keys.shared(day), userId));

/* ---------- Community receipts ---------- */

export type StoredReceipt = {
  id: string;
  title: string;
  author: string;
  authorId: string;
  items: ItemId[];
  difficulty: Difficulty;
  request?: SpecialRequest | null;
  note?: string | null;
  createdAt: number;
};

const isStoredReceipt = (v: unknown): v is StoredReceipt =>
  isObject(v) &&
  typeof v.id === 'string' &&
  typeof v.title === 'string' &&
  typeof v.author === 'string' &&
  Array.isArray(v.items) &&
  v.items.every(isItemId);

export const getReceipt = async (id: string): Promise<StoredReceipt | null> =>
  parseJson(await redis.get(keys.receipt(id)), isStoredReceipt);

export const addReceipt = async (
  receipt: Omit<StoredReceipt, 'id' | 'createdAt'>
): Promise<StoredReceipt> => {
  const id = String(await redis.incrBy(keys.receiptSeq(), 1));
  const stored: StoredReceipt = { ...receipt, id, createdAt: Date.now() };
  await redis.set(keys.receipt(id), JSON.stringify(stored));
  await redis.zAdd(keys.pendingReceipts(), { member: id, score: 0 });
  return stored;
};

export const removePendingReceipt = async (id: string): Promise<void> => {
  await redis.zRem(keys.pendingReceipts(), [id]);
};

export const listPendingReceipts = async (
  limit: number
): Promise<{ receipt: StoredReceipt; votes: number }[]> => {
  const rows = await redis.zRange(keys.pendingReceipts(), 0, limit - 1, {
    by: 'rank',
    reverse: true,
  });
  const receipts = await Promise.all(rows.map((row) => getReceipt(row.member)));
  const list: { receipt: StoredReceipt; votes: number }[] = [];
  rows.forEach((row, index) => {
    const receipt = receipts[index];
    if (receipt) list.push({ receipt, votes: row.score });
  });
  return list;
};

export const toCandidate = (
  receipt: StoredReceipt,
  votes: number
): ReceiptCandidate => ({
  id: receipt.id,
  title: receipt.title,
  author: receipt.author,
  items: receipt.items,
  difficulty: receipt.difficulty,
  request: receipt.request ?? null,
  note: receipt.note ?? null,
  votes,
});

/** Up to three receipts to vote on: the leaders, never your own. */
export const getCandidates = async (
  userId: string | undefined,
  votedFor: string | null
): Promise<ReceiptCandidate[]> => {
  const pending = await listPendingReceipts(12);
  const others = pending.filter((p) => p.receipt.authorId !== userId);
  const picked = others.slice(0, 3);
  const voted = votedFor
    ? others.find((p) => p.receipt.id === votedFor)
    : undefined;
  if (voted && !picked.includes(voted)) picked[picked.length - 1] = voted;
  return picked.map((p) => toCandidate(p.receipt, p.votes));
};

export const getVote = async (
  day: string,
  userId: string
): Promise<string | null> => (await redis.get(keys.vote(day, userId))) ?? null;

export const castVote = async (
  day: string,
  userId: string,
  receiptId: string
): Promise<void> => {
  const previous = await getVote(day, userId);
  if (previous === receiptId) return;
  if (previous) {
    const stillPending = await redis.zScore(keys.pendingReceipts(), previous);
    if (stillPending !== undefined)
      await redis.zIncrBy(keys.pendingReceipts(), previous, -1);
  }
  await redis.set(keys.vote(day, userId), receiptId, {
    expiration: new Date(Date.now() + 2 * DAY_SECONDS * 1000),
  });
  await redis.zIncrBy(keys.pendingReceipts(), receiptId, 1);
};

export const hasSubmitted = async (
  day: string,
  userId: string
): Promise<boolean> => Boolean(await redis.hGet(keys.submitted(day), userId));

export const markSubmitted = async (
  day: string,
  userId: string
): Promise<boolean> => {
  const created = (await redis.hSetNX(keys.submitted(day), userId, '1')) === 1;
  if (created) await redis.expire(keys.submitted(day), 3 * DAY_SECONDS);
  return created;
};

/** Takes the most voted receipt out of the queue. Needs at least one vote from another player. */
export const popWinningReceipt = async (): Promise<StoredReceipt | null> => {
  const [top] = await listPendingReceipts(1);
  if (!top || top.votes < 1) return null;
  await removePendingReceipt(top.receipt.id);
  return top.receipt;
};
