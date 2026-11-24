import { useEffect, useMemo, useState } from 'react';
import type { ReceiptResponse } from '../../shared/api';
import { ITEM_IDS, ITEMS } from '../../shared/items';
import {
  checkReceipt,
  RECEIPT_LIMITS,
  receiptCells,
  type ReceiptCheck,
} from '../../shared/receipts';
import type { ItemId } from '../../shared/types';
import { DIFFICULTY_LABELS, GRID_CELLS } from '../../shared/types';
import { ApiFailure, postJson } from '../utils/api';
import { sfx } from '../utils/sound';
import { Icon, ItemArt, TagBadges } from './Art';

type Props = { onClose: () => void; onSubmitted: () => void };

/** "Customer of the Day": write a receipt for the community to vote on. */
export const ReceiptEditor = ({ onClose, onSubmitted }: Props) => {
  const [title, setTitle] = useState('');
  const [items, setItems] = useState<ItemId[]>([]);
  const [checked, setChecked] = useState<{
    key: string;
    value: ReceiptCheck;
  } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const counts = useMemo(() => {
    const map = new Map<ItemId, number>();
    for (const id of items) map.set(id, (map.get(id) ?? 0) + 1);
    return map;
  }, [items]);
  const cells = receiptCells(items);

  // The solver runs locally (debounced) so the author gets instant feedback.
  const draftKey = `${title}|${items.join(',')}`;
  useEffect(() => {
    const id = window.setTimeout(() => {
      const value = checkReceipt({
        title: title.trim().length >= RECEIPT_LIMITS.minTitle ? title : 'Draft',
        items,
      });
      setChecked({ key: `${title}|${items.join(',')}`, value });
    }, 220);
    return () => window.clearTimeout(id);
  }, [items, title]);
  const checking = checked?.key !== draftKey;
  const check = checked?.value ?? null;

  const add = (id: ItemId) => {
    if (items.length >= RECEIPT_LIMITS.maxItems) return sfx.invalid();
    if ((counts.get(id) ?? 0) >= RECEIPT_LIMITS.maxCopies) return sfx.invalid();
    if (cells + ITEMS[id].w * ITEMS[id].h > GRID_CELLS) return sfx.invalid();
    sfx.pick();
    setItems([...items, id]);
  };

  const removeAt = (index: number) => {
    sfx.lift();
    setItems(items.filter((_, k) => k !== index));
  };

  const submit = async () => {
    setError(null);
    const final = checkReceipt({ title, items });
    if (!final.ok) {
      setError(final.reason);
      sfx.invalid();
      return;
    }
    setSending(true);
    try {
      const response = await postJson<ReceiptResponse>('/api/receipts', {
        title,
        items,
      });
      if (response.ok) {
        sfx.win();
        setDone(true);
        onSubmitted();
      } else {
        setError(response.reason);
        sfx.invalid();
      }
    } catch (e) {
      setError(
        e instanceof ApiFailure ? e.message : 'Could not send your receipt'
      );
    } finally {
      setSending(false);
    }
  };

  const verdict = (() => {
    if (items.length === 0) {
      return {
        tone: 'muted',
        text: `Pick ${RECEIPT_LIMITS.minItems} to ${RECEIPT_LIMITS.maxItems} groceries`,
      };
    }
    if (checking || !check)
      return { tone: 'muted', text: 'Checking the bag...' };
    if (check.ok)
      return {
        tone: 'good',
        text: `Packable · ${DIFFICULTY_LABELS[check.difficulty]}`,
      };
    return { tone: 'warn', text: check.reason };
  })();

  return (
    <div
      className="backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Write a receipt"
    >
      <div className="sheet flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2>Write tomorrow’s receipt</h2>
          <button
            type="button"
            className="icon-btn shrink-0"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="close" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="text-[var(--accent)]">
              <Icon name="receipt" size={44} />
            </div>
            <p className="m-0 text-[16px] font-extrabold">
              Your receipt is in the running!
            </p>
            <p className="muted m-0 text-[14px]">
              Baggers vote after solving. If yours gets the most votes, it
              becomes tomorrow’s puzzle with your name on it.
            </p>
            <button type="button" className="big-btn" onClick={onClose}>
              Back to my bag
            </button>
          </div>
        ) : (
          <>
            <input
              className="field"
              placeholder="Name it, e.g. Hosting my in-laws"
              maxLength={RECEIPT_LIMITS.maxTitle}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="Receipt name"
            />

            <section className="receipt">
              <div className="receipt-head">
                <span className="receipt-title">Your receipt</span>
                <span className="receipt-author">
                  {items.length}/{RECEIPT_LIMITS.maxItems} items · {cells}/
                  {GRID_CELLS} cells
                </span>
              </div>
              <div className="flex min-h-[44px] flex-wrap gap-1">
                {items.length === 0 && (
                  <span className="muted self-center text-[12px]">
                    Tap groceries below to add them
                  </span>
                )}
                {items.map((id, k) => (
                  <button
                    key={`${id}-${k}`}
                    type="button"
                    className="tile !h-[44px] !w-[44px] !p-1"
                    onClick={() => removeAt(k)}
                    aria-label={`Remove ${ITEMS[id].name}`}
                  >
                    <ItemArt id={id} className="art" />
                  </button>
                ))}
              </div>
            </section>

            <p className={`status m-0 !h-auto ${verdict.tone}`}>
              {verdict.text}
            </p>

            <div className="catalog">
              {ITEM_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="tile"
                  onClick={() => add(id)}
                  aria-label={`Add ${ITEMS[id].name}`}
                >
                  <span className="tile-art">
                    <ItemArt id={id} className="art" />
                  </span>
                  <span className="tile-name">{ITEMS[id].name}</span>
                  <TagBadges id={id} />
                  {counts.get(id) ? (
                    <span className="count-badge">{counts.get(id)}</span>
                  ) : null}
                </button>
              ))}
            </div>

            {error && <p className="status warn m-0 !h-auto">{error}</p>}
            <button
              type="button"
              className="big-btn"
              onClick={() => void submit()}
              disabled={
                sending ||
                !check?.ok ||
                title.trim().length < RECEIPT_LIMITS.minTitle
              }
            >
              {sending ? 'Sending...' : 'Submit for tomorrow'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
