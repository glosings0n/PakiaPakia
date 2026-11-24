import { Hono } from 'hono';
import type { Context as HonoContext } from 'hono';
import { context, reddit } from '@devvit/web/server';
import type {
  ApiError,
  GameInit,
  GameResult,
  ReceiptRequest,
  ReceiptResponse,
  SolveRequest,
  SplashInfo,
  VoteRequest,
  VoteResponse,
} from '../../shared/api';
import { dayKey, formatDuration } from '../../shared/dates';
import { checkReceipt } from '../../shared/receipts';
import type { DailyPostData, ItemId, Placement } from '../../shared/types';
import { bagSignature, buildBag, evaluate } from '../../shared/validator';
import { postUrl, resolveCurrentPost } from '../core/daily';
import {
  addReceipt,
  castVote,
  effectiveStreak,
  getCandidates,
  getCommunityBag,
  getDayPostId,
  getLeaderboard,
  getOpened,
  getRank,
  getReceipt,
  getSolve,
  getUser,
  getVote,
  hasShared,
  hasSubmitted,
  markOpened,
  markShared,
  markSubmitted,
  recordSolve,
  solveCount,
  unmarkShared,
  updateUserAfterSolve,
  type StoredSolve,
} from '../redis';

export const api = new Hono();

const fail = (
  c: HonoContext,
  message: string,
  status: 400 | 401 | 403 | 404 | 409 | 500 = 400
) => c.json<ApiError>({ status: 'error', message }, status);

const isPlacement = (v: unknown): v is Placement =>
  typeof v === 'object' &&
  v !== null &&
  'i' in v &&
  'r' in v &&
  'c' in v &&
  'rot' in v &&
  typeof v.i === 'number' &&
  typeof v.r === 'number' &&
  typeof v.c === 'number' &&
  typeof v.rot === 'boolean';

const bagItems = (
  data: DailyPostData,
  placements: Placement[]
): (ItemId | null)[] => {
  const bag = buildBag(data.puzzle, placements);
  return (bag ?? [])
    .flat()
    .map((instance) =>
      instance === null ? null : (data.puzzle.items[instance] ?? null)
    );
};

const buildResult = async (
  data: DailyPostData,
  userId: string,
  solve: StoredSolve
): Promise<GameResult> => {
  const today = dayKey();
  const [
    rank,
    total,
    user,
    leaderboard,
    community,
    votedFor,
    submitted,
    shared,
    todayPostId,
  ] = await Promise.all([
    getRank(data.day, userId),
    solveCount(data.day),
    getUser(userId),
    getLeaderboard(data.day, userId),
    getCommunityBag(
      data.day,
      solve.signature,
      bagItems(data, solve.placements)
    ),
    getVote(today, userId),
    hasSubmitted(today, userId),
    hasShared(data.day, userId),
    data.day === today ? Promise.resolve(null) : getDayPostId(today),
  ]);
  const candidates = await getCandidates(userId, votedFor);
  const position = rank ?? total;
  return {
    day: data.day,
    number: data.number,
    timeMs: solve.timeMs,
    moves: solve.moves,
    placements: solve.placements,
    rank: position,
    totalSolves: total,
    beatPct:
      total > 1 ? Math.round(((total - position) / (total - 1)) * 100) : 100,
    streak: effectiveStreak(user, today),
    maxStreak: user.maxStreak,
    leaderboard,
    community,
    candidates,
    votedFor,
    canWriteReceipt: !submitted,
    submittedReceipt: submitted,
    shared,
    isToday: data.day === today,
    todayPostUrl:
      todayPostId && todayPostId !== context.postId
        ? postUrl(todayPostId)
        : null,
  };
};

api.get('/game', async (c) => {
  try {
    const data = await resolveCurrentPost();
    const userId = context.userId;
    const today = dayKey();
    const [solvesToday, user, solve] = await Promise.all([
      solveCount(data.day),
      userId ? getUser(userId) : Promise.resolve(null),
      userId ? getSolve(data.day, userId) : Promise.resolve(null),
    ]);
    if (userId && !solve) await markOpened(data.day, userId);
    const result =
      userId && solve ? await buildResult(data, userId, solve) : null;
    return c.json<GameInit>({
      day: data.day,
      number: data.number,
      puzzle: data.puzzle,
      isToday: data.day === today,
      user: {
        loggedIn: Boolean(userId),
        username: context.username ?? null,
        streak: user ? effectiveStreak(user, today) : 0,
        maxStreak: user?.maxStreak ?? 0,
        solved: user?.solved ?? 0,
      },
      result,
      solvesToday,
    });
  } catch (error) {
    console.error('GET /api/game failed', error);
    return fail(c, "Could not load today's bag", 500);
  }
});

api.get('/splash', async (c) => {
  try {
    const data = await resolveCurrentPost();
    const userId = context.userId;
    const [solvesToday, solve, user] = await Promise.all([
      solveCount(data.day),
      userId ? getSolve(data.day, userId) : Promise.resolve(null),
      userId ? getUser(userId) : Promise.resolve(null),
    ]);
    return c.json<SplashInfo>({
      solvesToday,
      solved: Boolean(solve),
      timeMs: solve?.timeMs ?? null,
      streak: user ? effectiveStreak(user, dayKey()) : 0,
    });
  } catch (error) {
    console.error('GET /api/splash failed', error);
    return fail(c, 'Could not load stats', 500);
  }
});

api.post('/solve', async (c) => {
  const userId = context.userId;
  if (!userId) return fail(c, 'Log in to save your bag', 401);
  let body: Partial<SolveRequest>;
  try {
    body = await c.req.json<Partial<SolveRequest>>();
  } catch {
    return fail(c, 'Invalid request');
  }
  const placements = Array.isArray(body.placements)
    ? body.placements.filter(isPlacement)
    : [];
  const data = await resolveCurrentPost();
  const evaluation = evaluate(data.puzzle, placements);
  if (!evaluation.solved)
    return fail(c, evaluation.error ?? 'The bag is not finished yet');

  const existing = await getSolve(data.day, userId);
  if (existing)
    return c.json<GameResult>(await buildResult(data, userId, existing));

  const now = Date.now();
  const opened = await getOpened(data.day, userId);
  const clientMs = Number.isFinite(body.elapsedMs) ? Number(body.elapsedMs) : 0;
  const serverMs = opened ? now - opened : clientMs;
  // Trust the client's active-play timer, but never beyond what the server observed.
  const timeMs = Math.round(
    Math.max(1000, Math.min(clientMs || serverMs, serverMs + 3000))
  );
  const moves = Math.max(
    placements.length,
    Math.min(999, Math.round(Number(body.moves) || placements.length))
  );

  const solve: StoredSolve = {
    timeMs,
    moves,
    placements,
    signature: bagSignature(data.puzzle, placements),
    at: now,
  };
  const bag = buildBag(data.puzzle, placements)?.flat() ?? [];
  const first = await recordSolve(data.day, userId, solve, data.puzzle, bag);
  const stored = first ? solve : ((await getSolve(data.day, userId)) ?? solve);
  if (first) {
    const user = await updateUserAfterSolve(
      userId,
      { name: context.username ?? '', avatar: context.snoovatar ?? '' },
      data.day,
      dayKey()
    );
    if (data.day === dayKey() && user.streak >= 2 && context.username) {
      try {
        await reddit.setUserFlair({
          subredditName: context.subredditName,
          username: context.username,
          text: `${user.streak}-day bagger`,
        });
      } catch (error) {
        console.error('Could not set streak flair', error);
      }
    }
  }
  return c.json<GameResult>(await buildResult(data, userId, stored));
});

api.post('/share', async (c) => {
  const userId = context.userId;
  if (!userId) return fail(c, 'Log in to comment', 401);
  const data = await resolveCurrentPost();
  const solve = await getSolve(data.day, userId);
  if (!solve) return fail(c, 'Pack the bag first', 403);
  if (!context.postId) return fail(c, 'No post to comment on');
  if (!(await markShared(data.day, userId)))
    return fail(c, 'Already shared', 409);
  const user = await getUser(userId);
  const streak = effectiveStreak(user, dayKey());
  const lines = [
    `**Pakia Pakia! #${data.number}**: packed in **${formatDuration(solve.timeMs)}** with ${solve.moves} moves`,
    streak >= 2 ? `${streak}-day streak` : null,
  ].filter(Boolean);
  try {
    await reddit.submitComment({
      id: context.postId,
      text: lines.join('\n\n'),
      runAs: 'USER',
    });
    return c.json({ status: 'ok' });
  } catch (error) {
    console.error('Could not comment as user', error);
    await unmarkShared(data.day, userId);
    return fail(c, 'Could not post your comment', 500);
  }
});

api.post('/subscribe', async (c) => {
  if (!context.userId) return fail(c, 'Log in to join', 401);
  try {
    await reddit.subscribeToCurrentSubreddit();
    return c.json({ status: 'ok' });
  } catch (error) {
    console.error('Could not subscribe user', error);
    return fail(c, 'Could not join right now', 500);
  }
});

api.post('/vote', async (c) => {
  const userId = context.userId;
  if (!userId) return fail(c, 'Log in to vote', 401);
  let body: Partial<VoteRequest>;
  try {
    body = await c.req.json<Partial<VoteRequest>>();
  } catch {
    return fail(c, 'Invalid request');
  }
  if (typeof body.receiptId !== 'string') return fail(c, 'Pick a receipt');
  const data = await resolveCurrentPost();
  if (!(await getSolve(data.day, userId)))
    return fail(c, 'Pack the bag before voting', 403);
  const receipt = await getReceipt(body.receiptId);
  if (!receipt) return fail(c, 'That receipt is gone', 404);
  if (receipt.authorId === userId)
    return fail(c, 'You cannot vote for your own receipt', 403);
  const today = dayKey();
  await castVote(today, userId, receipt.id);
  const votedFor = await getVote(today, userId);
  return c.json<VoteResponse>({
    candidates: await getCandidates(userId, votedFor),
    votedFor,
  });
});

api.post('/receipts', async (c) => {
  const userId = context.userId;
  const username = context.username;
  if (!userId || !username) return fail(c, 'Log in to write a receipt', 401);
  let body: Partial<ReceiptRequest>;
  try {
    body = await c.req.json<Partial<ReceiptRequest>>();
  } catch {
    return fail(c, 'Invalid request');
  }
  const user = await getUser(userId);
  if (user.solved < 1)
    return c.json<ReceiptResponse>({
      ok: false,
      reason: 'Pack a bag before writing one',
    });
  const check = checkReceipt({
    title: body.title,
    items: body.items,
    request: body.request,
    note: body.note,
  });
  if (!check.ok)
    return c.json<ReceiptResponse>({ ok: false, reason: check.reason });
  const today = dayKey();
  if (!(await markSubmitted(today, userId))) {
    return c.json<ReceiptResponse>({
      ok: false,
      reason: 'One receipt per day. Come back tomorrow!',
    });
  }
  await addReceipt({
    title: check.title,
    author: username,
    authorId: userId,
    items: check.items,
    difficulty: check.difficulty,
    request: check.request,
    note: check.note,
  });
  return c.json<ReceiptResponse>({ ok: true, difficulty: check.difficulty });
});
