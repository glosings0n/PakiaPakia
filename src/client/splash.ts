import './splash.css';

import { context, requestExpandedMode } from '@devvit/web/client';
import type { SplashInfo } from '../shared/api';
import { dayKey, dayNumber, formatDay, formatDuration } from '../shared/dates';
import { isDailyPostData } from '../shared/guards';
import { itemCells } from '../shared/items';
import { houseReceiptFor } from '../shared/puzzles';
import { DIFFICULTY_LABELS } from '../shared/types';
import { itemSvg } from './art/items';

/** Inline feed card: renders instantly from postData, then fills in live stats. */

const $ = (id: string): HTMLElement | null => document.getElementById(id);

const day = isDailyPostData(context.postData) ? context.postData.day : dayKey();
const number = isDailyPostData(context.postData)
  ? context.postData.number
  : dayNumber(day);
const puzzle = isDailyPostData(context.postData)
  ? context.postData.puzzle
  : houseReceiptFor(day);

const set = (id: string, text: string) => {
  const el = $(id);
  if (el) el.textContent = text;
};

set('date', `#${number} · ${formatDay(day)}`);
set('title', `“${puzzle.title}”`);
set(
  'meta',
  `${puzzle.author ? `by u/${puzzle.author}` : 'House receipt'} · ${puzzle.items.length} items · ${DIFFICULTY_LABELS[puzzle.difficulty]}`
);

// The three biggest groceries peek out of the bag.
const peek = $('peek');
if (peek) {
  const unique = [...new Set(puzzle.items)]
    .sort((a, b) => itemCells(b) - itemCells(a))
    .slice(0, 3);
  peek.innerHTML = unique
    .map((id) => `<span class="peek-item">${itemSvg(id)}</span>`)
    .join('');
}

const open = (event: MouseEvent) => requestExpandedMode(event, 'game');
$('play')?.addEventListener('click', open);
$('bag')?.addEventListener('click', open);

fetch('/api/splash')
  .then((res) => (res.ok ? res.json() : null))
  .then((info: SplashInfo | null) => {
    if (!info) return;
    const parts = [
      info.solvesToday === 0
        ? 'Be the first to bag it'
        : `${info.solvesToday} bagger${info.solvesToday === 1 ? '' : 's'} so far`,
    ];
    if (info.streak > 1) parts.push(`${info.streak}-day streak`);
    set('stats', parts.join(' · '));
    if (info.solved) {
      set(
        'play',
        `Packed in ${formatDuration(info.timeMs ?? 0)} · See results`
      );
      $('play')?.classList.add('done');
    }
  })
  .catch(() => {
    set('stats', ' ');
  });
