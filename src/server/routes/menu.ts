import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { createDailyPost } from '../core/daily';
import { listPendingReceipts } from '../redis';

export const menu = new Hono();

/** Moderator action: post today's bag (creates a fresh post for the current day). */
menu.post('/post-today', async (c) => {
  try {
    const post = await createDailyPost();
    return c.json<UiResponse>({ navigateTo: post.url }, 200);
  } catch (error) {
    console.error('Could not create the daily post', error);
    return c.json<UiResponse>({ showToast: 'Could not create the post' }, 400);
  }
});

/** Moderator action: review and remove pending community receipts. */
menu.post('/review-receipts', async (c) => {
  const pending = await listPendingReceipts(25);
  if (pending.length === 0) {
    return c.json<UiResponse>(
      { showToast: 'No community receipts are waiting' },
      200
    );
  }
  return c.json<UiResponse>(
    {
      showForm: {
        name: 'removeReceiptForm',
        form: {
          title: 'Remove community receipts',
          description: 'Selected receipts will never become a daily puzzle.',
          acceptLabel: 'Remove',
          fields: [
            {
              name: 'receiptIds',
              label: 'Pending receipts',
              type: 'select',
              multiSelect: true,
              required: true,
              options: pending.map(({ receipt, votes }) => ({
                label: `"${receipt.title}" by u/${receipt.author} (${votes} votes)`,
                value: receipt.id,
              })),
            },
          ],
        },
      },
    },
    200
  );
});
