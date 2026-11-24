import { Hono } from 'hono';
import type { TriggerResponse } from '@devvit/web/shared';
import { ensureTodayPost } from '../core/daily';

export const triggers = new Hono();

triggers.post('/on-app-install', async (c) => {
  try {
    const post = await ensureTodayPost();
    return c.json<TriggerResponse>(
      { status: 'success', message: `Daily post ready: ${post.id}` },
      200
    );
  } catch (error) {
    console.error('Could not create the first daily post', error);
    return c.json<TriggerResponse>(
      { status: 'error', message: 'Failed to create the daily post' },
      400
    );
  }
});
