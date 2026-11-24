/**
 * Runs the real Hono API routes against the in-memory mocks.
 * Player and day come from the page URL (?user=alice&day=2026-12-09), read from the Referer header.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { getRequestListener } from '@hono/node-server';
import { Hono } from 'hono';
import { dayKey, dayNumber, isDayKey } from '../../src/shared/dates';
import { houseReceiptFor } from '../../src/shared/puzzles';
import { checkReceipt } from '../../src/shared/receipts';
import {
  REQUEST_INFO,
  REQUEST_KINDS,
  type SpecialRequest,
} from '../../src/shared/requests';
import type { ItemId } from '../../src/shared/types';
import { getOrChooseDayPuzzle } from '../../src/server/core/daily';
import { addReceipt, castVote, keys } from '../../src/server/redis';
import { api } from '../../src/server/routes/api';
import { comments, context, redis, resetStore } from './mockServer';

const app = new Hono();
app.route('/api', api);

app.post('/__dev/reset', async (c) => {
  resetStore();
  comments.length = 0;
  return c.json({ status: 'ok' });
});

/** The first special request that makes this sample receipt valid. */
const withRequest = (title: string, items: ItemId[], note: string) => {
  const singles = [...new Set(items)].filter(
    (id) => items.filter((x) => x === id).length === 1
  );
  for (const kind of REQUEST_KINDS) {
    for (const item of singles) {
      const others = REQUEST_INFO[kind].pair
        ? singles.filter((x) => x !== item)
        : [undefined];
      for (const other of others) {
        const request: SpecialRequest = other
          ? { kind, item, other }
          : { kind, item };
        const check = checkReceipt({ title, items, request, note });
        if (check.ok) return check;
      }
    }
  }
  return null;
};

/** Adds three community receipts from fake players, with a few votes. */
app.post('/__dev/seed', async (c) => {
  const samples: {
    author: string;
    title: string;
    note?: string;
    items: ItemId[];
    votes: number;
  }[] = [
    {
      author: 'pantry_queen',
      title: 'Hosting my in-laws',
      note: 'Local test note',
      items: [
        'turkey',
        'wine',
        'wine',
        'cake',
        'cheese',
        'bread',
        'coffee',
        'apples',
      ],
      votes: 3,
    },
    {
      author: 'night_owl',
      title: 'Midnight snack run',
      items: [
        'icecream',
        'icecream',
        'chips',
        'pizza',
        'coffee',
        'soup',
        'cereal',
        'water',
        'apples',
        'rice',
      ],
      votes: 1,
    },
    {
      author: 'gym_bro',
      title: 'Bulking season',
      items: [
        'rice',
        'rice',
        'eggs',
        'eggs',
        'chicken',
        'milk',
        'water',
        'apples',
      ],
      votes: 0,
    },
  ];
  const created: string[] = [];
  for (const sample of samples) {
    const check = withRequest(sample.title, sample.items, sample.note ?? '');
    if (!check) continue;
    const receipt = await addReceipt({
      title: check.title,
      author: sample.author,
      authorId: `t2_${sample.author}`,
      items: check.items,
      difficulty: check.difficulty,
      request: check.request,
      note: check.note,
    });
    for (let v = 0; v < sample.votes; v++)
      await castVote(dayKey(), `t2_voter${v}_${receipt.id}`, receipt.id);
    created.push(sample.title);
  }
  return c.json({ status: 'ok', created });
});

/** Simulates the 00:00 UTC rollover for today: elects the most voted receipt. */
app.post('/__dev/elect', async (c) => {
  const today = dayKey();
  await redis.del(keys.dayPuzzle(today));
  const { puzzle, elected } = await getOrChooseDayPuzzle(today);
  return c.json({
    status: 'ok',
    elected,
    title: puzzle.title,
    author: puzzle.author,
  });
});

app.get('/__dev/comments', (c) => c.json(comments));

const listener = getRequestListener(app.fetch);

export const handle = async (
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> => {
  const referer = req.headers.referer ?? '';
  let params = new URLSearchParams();
  try {
    params = new URL(referer).searchParams;
  } catch {
    // No referer: default player and day.
  }
  const user = params.get('user') ?? 'local_bagger';
  const day = params.get('day');
  context.userId = user === 'guest' ? undefined : `t2_${user}`;
  context.username = user === 'guest' ? undefined : user;
  context.snoovatar = undefined;
  if (day && isDayKey(day) && day !== dayKey()) {
    context.postId = `t3_local_${day}`;
    context.postData = {
      day,
      number: dayNumber(day),
      puzzle: houseReceiptFor(day),
    };
  } else {
    context.postId = 't3_local';
    context.postData = undefined;
  }
  await listener(req, res);
};
