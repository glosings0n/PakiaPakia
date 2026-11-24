import { Hono } from 'hono';
import { ensureTodayPost } from '../core/daily';

export const scheduler = new Hono();

/** Runs at 00:00 UTC: elects tomorrow's customer and opens the new bag. */
scheduler.post('/daily-post', async (c) => {
  try {
    const post = await ensureTodayPost();
    return c.json(
      { status: 'ok', postId: post.id, created: post.created },
      200
    );
  } catch (error) {
    console.error('Scheduled daily post failed', error);
    return c.json({ status: 'error' }, 500);
  }
});
