import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { removePendingReceipt } from '../redis';

export const forms = new Hono();

forms.post('/remove-receipt', async (c) => {
  const { receiptIds } = await c.req.json<{ receiptIds?: unknown }>();
  const ids = (Array.isArray(receiptIds) ? receiptIds : [receiptIds]).filter(
    (id): id is string => typeof id === 'string'
  );
  await Promise.all(ids.map((id) => removePendingReceipt(id)));
  return c.json<UiResponse>(
    {
      showToast: `Removed ${ids.length} receipt${ids.length === 1 ? '' : 's'}`,
    },
    200
  );
});
