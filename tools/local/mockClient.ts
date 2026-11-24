/**
 * Local stand-in for `@devvit/web/client`, used only by `npm run dev:local`.
 * Also injects a small DEV panel to switch player, jump to a day and seed data.
 */
import { dayKey, dayNumber, isDayKey } from '../../src/shared/dates';
import { houseReceiptFor } from '../../src/shared/puzzles';

const params = new URLSearchParams(location.search);
const user = params.get('user') ?? 'local_bagger';
const day = params.get('day');

export const context = {
  username: user === 'guest' ? undefined : user,
  userId: user === 'guest' ? undefined : `t2_${user}`,
  subredditName: 'PakiaLocal',
  postId: 't3_local',
  postData:
    day && isDayKey(day) && day !== dayKey()
      ? { day, number: dayNumber(day), puzzle: houseReceiptFor(day) }
      : undefined,
  snoovatar: undefined,
};

const toastHost = () => {
  let host = document.getElementById('local-toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'local-toasts';
    host.style.cssText =
      'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:6px;pointer-events:none';
    document.body.appendChild(host);
  }
  return host;
};

export const showToast = (toast: string | { text: string }) => {
  const el = document.createElement('div');
  el.textContent = typeof toast === 'string' ? toast : toast.text;
  el.style.cssText =
    'background:#2b2622;color:#fbf6ea;padding:8px 14px;border-radius:10px;font:600 14px Fredoka,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.3)';
  toastHost().appendChild(el);
  window.setTimeout(() => el.remove(), 2600);
};

export const navigateTo = (url: string) => {
  window.open(url, '_blank');
};

export const showLoginPrompt = () =>
  showToast('Locally, add ?user=yourname to the URL to "log in".');

export const requestExpandedMode = (_event: MouseEvent, entry: string) => {
  location.href = `${entry}.html${location.search}`;
};

export const getWebViewMode = () =>
  location.pathname.includes('splash') ? 'inline' : 'expanded';

/* ---------- DEV panel ---------- */
const PANEL_ID = 'pakia-dev';

/** Explicit styles: the game's CSS reset strips buttons and selects bare. */
const PANEL_CSS = `
#${PANEL_ID} { position: fixed; left: 50%; top: 4px; transform: translateX(-50%); z-index: 9998;
  background: #fffdf7; color: #2b2622; border: 2px solid #2b2622; border-radius: 10px;
  padding: 3px 10px; font: 500 13px/1.3 Fredoka, sans-serif; width: max-content; max-width: 260px;
  box-shadow: 0 2px 0 rgba(43, 38, 34, 0.3); }
#${PANEL_ID}[open] { padding: 6px 10px 10px; }
#${PANEL_ID} summary { cursor: pointer; font-weight: 700; list-style: none; text-align: center; }
#${PANEL_ID} summary::-webkit-details-marker { display: none; }
#${PANEL_ID} .who { margin: 6px 0 8px; color: #7a6c5d; font-size: 12px; }
#${PANEL_ID} .stack { display: flex; flex-direction: column; gap: 6px; }
#${PANEL_ID} label { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
#${PANEL_ID} select, #${PANEL_ID} input { font: inherit; color: inherit; background: #fff;
  border: 1.5px solid #2b2622; border-radius: 6px; padding: 2px 6px; }
#${PANEL_ID} button { font: inherit; color: inherit; text-align: left; cursor: pointer;
  background: #f6ecda; border: 1.5px solid #2b2622; border-radius: 8px; padding: 5px 8px; }
#${PANEL_ID} button:hover { background: #efe1c6; }
#${PANEL_ID} button.danger { color: #d9452b; border-color: #d9452b; background: #fff; }
`;

const panel = () => {
  // Vite hot reload runs this module again: keep a single panel.
  document.getElementById(PANEL_ID)?.remove();
  if (!document.getElementById(`${PANEL_ID}-css`)) {
    const style = document.createElement('style');
    style.id = `${PANEL_ID}-css`;
    style.textContent = PANEL_CSS;
    document.head.appendChild(style);
  }
  const box = document.createElement('details');
  box.id = PANEL_ID;
  const go = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(location.search);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    location.search = next.toString();
  };
  const post = async (path: string) => {
    const res = await fetch(path, { method: 'POST' });
    return res.json();
  };
  box.innerHTML = `<summary>Dev menu</summary>
    <div class="who">Playing as u/${user}${day ? ` · ${day}` : ''}</div>
    <div class="stack">
      <label>Player <select data-k="user">${[
        'local_bagger',
        'alice',
        'bob',
        'carol',
        'guest',
      ]
        .map((u) => `<option ${u === user ? 'selected' : ''}>${u}</option>`)
        .join('')}</select></label>
      <label>Day <input data-k="day" type="date" value="${day ?? dayKey()}"></label>
      <button data-a="today">Back to today</button>
      <button data-a="splash">Open the feed card (splash)</button>
      <button data-a="seed">Seed 3 community receipts</button>
      <button data-a="solves">Add 12 solves from other players</button>
      <button data-a="elect">Run the midnight election</button>
      <button data-a="progress">Forget my local progress</button>
      <button data-a="reset" class="danger">Reset all server data</button>
    </div>`;
  box
    .querySelector<HTMLSelectElement>('[data-k="user"]')
    ?.addEventListener('change', (e) => {
      go({ user: (e.target as HTMLSelectElement).value });
    });
  box
    .querySelector<HTMLInputElement>('[data-k="day"]')
    ?.addEventListener('change', (e) => {
      go({ day: (e.target as HTMLInputElement).value });
    });
  box.addEventListener('click', (e) => {
    const action = (e.target as HTMLElement).dataset.a;
    if (!action) return;
    if (action === 'today') go({ day: null });
    if (action === 'splash') location.href = `splash.html${location.search}`;
    if (action === 'seed')
      void post('/__dev/seed').then(() =>
        showToast('3 receipts are waiting for votes')
      );
    if (action === 'solves')
      void post(`/__dev/solves${day ? `?day=${day}` : ''}`).then(
        (r: { added?: number }) => {
          showToast(`${r.added ?? 0} players packed this bag`);
          window.setTimeout(() => location.reload(), 900);
        }
      );
    if (action === 'elect')
      void post('/__dev/elect').then(
        (r: { elected: boolean; title: string }) => {
          showToast(
            r.elected
              ? `Today is now "${r.title}"`
              : 'No voted receipt: house receipt kept'
          );
          window.setTimeout(() => location.reload(), 900);
        }
      );
    if (action === 'progress') {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('pakia:'))
        .forEach((k) => localStorage.removeItem(k));
      location.reload();
    }
    if (action === 'reset')
      void post('/__dev/reset').then(() => location.reload());
  });
  document.body.appendChild(box);
};

if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', panel);
else panel();
