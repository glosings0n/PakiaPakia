import { context, reddit } from '@devvit/web/server';
import { dayKey, dayNumber, formatDay } from '../../shared/dates';
import { ITEMS } from '../../shared/items';
import { houseReceiptFor } from '../../shared/puzzles';
import { describeRequest } from '../../shared/requests';
import type { DailyPostData, Puzzle } from '../../shared/types';
import {
  getDayPostId,
  getDayPuzzle,
  getPostData,
  isDailyPostData,
  popWinningReceipt,
  savePostData,
  setDayPostId,
  setDayPuzzle,
} from '../redis';

/**
 * Today's receipt: the community's most voted receipt if there is one,
 * otherwise the verified house receipt for the day. Chosen once per day.
 */
export const getOrChooseDayPuzzle = async (
  day: string
): Promise<{ puzzle: Puzzle; elected: boolean }> => {
  const existing = await getDayPuzzle(day);
  if (existing) return { puzzle: existing, elected: false };
  const winner = await popWinningReceipt();
  const puzzle: Puzzle = winner
    ? {
        title: winner.title,
        author: winner.author,
        items: winner.items,
        difficulty: winner.difficulty,
        request: winner.request ?? null,
        note: winner.note ?? null,
      }
    : houseReceiptFor(day);
  await setDayPuzzle(day, puzzle);
  return { puzzle, elected: Boolean(winner) };
};

/** Resolves which day and receipt the current post is about. */
export const resolveCurrentPost = async (): Promise<DailyPostData> => {
  if (isDailyPostData(context.postData)) return context.postData;
  const postId = context.postId;
  if (postId) {
    const stored = await getPostData(postId);
    if (stored) return stored;
  }
  const day = dayKey();
  const { puzzle } = await getOrChooseDayPuzzle(day);
  return { day, number: dayNumber(day), puzzle };
};

const postTitle = (data: DailyPostData): string => {
  const base = `Pakia Pakia! #${data.number} · ${formatDay(data.day)} · "${data.puzzle.title}"`;
  return data.puzzle.author ? `${base} by u/${data.puzzle.author}` : base;
};

const receiptText = (puzzle: Puzzle): string =>
  puzzle.items.map((id) => `- ${ITEMS[id].name}`).join('\n');

const requestText = (puzzle: Puzzle): string =>
  puzzle.request
    ? `\n\nSpecial request: ${describeRequest(puzzle.request)}${puzzle.note ? ` "${puzzle.note}"` : ''}`
    : '';

/** Creates the interactive post for a day and announces the customer in a sticky comment. */
export const createDailyPost = async (
  day: string = dayKey()
): Promise<{ id: string; url: string; elected: boolean }> => {
  const { puzzle, elected } = await getOrChooseDayPuzzle(day);
  const data: DailyPostData = { day, number: dayNumber(day), puzzle };
  const post = await reddit.submitCustomPost({
    title: postTitle(data),
    entry: 'default',
    postData: data,
    styles: { backgroundColor: '#E9D8BEFF', backgroundColorDark: '#1F1A16FF' },
    textFallback: {
      text: `Today's receipt: "${puzzle.title}". Pack every item into a 5x5 bag without breaking the house rules.\n\n${receiptText(puzzle)}${requestText(puzzle)}`,
    },
  });
  await Promise.all([savePostData(post.id, data), setDayPostId(day, post.id)]);

  const intro = puzzle.author
    ? `**Today's customer is u/${puzzle.author}**, voted in by yesterday's baggers. Thank them for "${puzzle.title}"!`
    : `**Today's receipt: "${puzzle.title}"** from the house kitchen.`;
  try {
    const comment = await reddit.submitComment({
      id: post.id,
      text: `${intro}${requestText(puzzle)}\n\nPost your time below, but keep it spoiler-free: no bag layouts. Want your own groceries to be tomorrow's puzzle? Solve today's bag, then tap **Write a receipt**.`,
      runAs: 'APP',
    });
    await comment.distinguish(true);
  } catch (error) {
    console.error('Could not post the sticky intro comment', error);
  }

  if (puzzle.author && elected) {
    try {
      await reddit.setUserFlair({
        subredditName: context.subredditName,
        username: puzzle.author,
        text: 'Customer of the Day',
      });
    } catch (error) {
      console.error('Could not set the customer flair', error);
    }
  }
  return { id: post.id, url: post.url, elected };
};

/** Creates today's post only if it does not exist yet (used by the scheduler and on install). */
export const ensureTodayPost = async (): Promise<{
  id: string;
  url: string;
  created: boolean;
}> => {
  const day = dayKey();
  const existing = await getDayPostId(day);
  if (existing) {
    return { id: existing, url: postUrl(existing), created: false };
  }
  const post = await createDailyPost(day);
  return { id: post.id, url: post.url, created: true };
};

export const postUrl = (postId: string): string =>
  `https://www.reddit.com/r/${context.subredditName}/comments/${postId.replace(/^t3_/, '')}`;
