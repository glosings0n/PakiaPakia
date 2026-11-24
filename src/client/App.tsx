import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  context,
  navigateTo,
  showLoginPrompt,
  showToast,
} from '@devvit/web/client';
import type { GameInit, GameResult, VoteResponse } from '../shared/api';
import { dayKey, dayNumber, formatDay, formatDuration } from '../shared/dates';
import { isDailyPostData } from '../shared/guards';
import { canRotate, footprint, ITEMS } from '../shared/items';
import { houseReceiptFor } from '../shared/puzzles';
import type { Placement, Puzzle, RuleId } from '../shared/types';
import { DIFFICULTY_LABELS, GRID_COLS, GRID_ROWS } from '../shared/types';
import { evaluate, fits } from '../shared/validator';
import { Icon, ItemArt, TagIcon } from './components/Art';
import { BagGrid, type Preview } from './components/BagGrid';
import { HelpSheet } from './components/HelpSheet';
import { ItemTray } from './components/ItemTray';
import { ReceiptEditor } from './components/ReceiptEditor';
import { ResultCard, type GuestResult } from './components/ResultCard';
import { useBoard } from './hooks/useGame';
import { conflictMessage, RULES } from './rules';
import { ApiFailure, getJson, postJson } from './utils/api';
import { isMuted, setMuted, sfx } from './utils/sound';
import { flag, setFlag } from './utils/storage';

type Phase = 'playing' | 'stamping' | 'done';
type Sheet = 'result' | 'editor' | 'help' | null;
type Flash = { text: string; tone: 'info' | 'warn' | 'good' };
type Drag = {
  i: number;
  from: 'tray' | 'bag';
  startX: number;
  startY: number;
  x: number;
  y: number;
  moved: boolean;
  touch: boolean;
  rot: boolean;
};
type Target = { inside: boolean; placement: Placement; ok: boolean };

const ONBOARDED_KEY = 'pakia:onboarded';
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/** What the post is about, known instantly from postData (no network round trip). */
const initialPost = (): { day: string; number: number; puzzle: Puzzle } => {
  if (isDailyPostData(context.postData)) return context.postData;
  const day = dayKey();
  return { day, number: dayNumber(day), puzzle: houseReceiptFor(day) };
};

export const App = () => {
  const [post, setPost] = useState(initialPost);
  const [server, setServer] = useState<GameInit | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    getJson<GameInit>('/api/game')
      .then((data) => {
        setServer(data);
        setPost((current) =>
          current.day === data.day &&
          current.puzzle.items.join() === data.puzzle.items.join()
            ? current
            : { day: data.day, number: data.number, puzzle: data.puzzle }
        );
      })
      .catch((error: unknown) => {
        console.error('Could not load the game', error);
        setLoadFailed(true);
      });
  }, []);

  const finished = server?.result ?? null;
  return (
    <Game
      key={`${post.day}:${post.puzzle.items.join()}:${finished ? 'done' : 'play'}`}
      {...post}
      server={server}
      finished={finished}
      offline={loadFailed}
    />
  );
};

type GameProps = {
  day: string;
  number: number;
  puzzle: Puzzle;
  server: GameInit | null;
  finished: GameResult | null;
  offline: boolean;
};

const Game = ({
  day,
  number,
  puzzle,
  server,
  finished,
  offline,
}: GameProps) => {
  const { state, dispatch, evaluation } = useBoard(
    day,
    puzzle,
    finished?.placements ?? null
  );
  const [phase, setPhase] = useState<Phase>(finished ? 'done' : 'playing');
  const [sheet, setSheet] = useState<Sheet>(finished ? 'result' : null);
  const [result, setResult] = useState<GameResult | null>(finished);
  const [guest, setGuest] = useState<GuestResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [finalMs, setFinalMs] = useState(finished?.timeMs ?? 0);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [ghost, setGhost] = useState<Drag | null>(null);
  const [cell, setCell] = useState(56);
  const [tileH, setTileH] = useState(64);
  const [now, setNow] = useState(() => Date.now());
  const [muted, setMutedState] = useState(isMuted);
  const [onboarded, setOnboarded] = useState(() => flag(ONBOARDED_KEY));
  const [introRules, setIntroRules] = useState(false);
  const [shareState, setShareState] = useState<'idle' | 'busy' | 'done'>(
    'idle'
  );
  const [joinState, setJoinState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [voting, setVoting] = useState<string | null>(null);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);
  const prevConflicts = useRef(new Set<string>());
  const [tipped, setTipped] = useState<number | null>(null);

  const placedSet = useMemo(
    () => new Set(state.placements.map((p) => p.i)),
    [state.placements]
  );
  const conflictsByItem = useMemo(() => {
    const map = new Map<number, RuleId[]>();
    for (const conflict of evaluation.conflicts) {
      const first = conflict.items[0];
      if (first === undefined) continue;
      map.set(first, [...(map.get(first) ?? []), conflict.rule]);
    }
    return map;
  }, [evaluation.conflicts]);
  const brokenRules = useMemo(
    () => new Set(evaluation.conflicts.map((c) => c.rule)),
    [evaluation.conflicts]
  );

  const say = useCallback(
    (text: string, tone: Flash['tone'] = 'info', ms = 2400) => {
      window.clearTimeout(flashTimer.current);
      setFlash({ text, tone });
      flashTimer.current = window.setTimeout(() => setFlash(null), ms);
    },
    []
  );

  /* ----- Layout: biggest bag that fits the viewport ----- */
  useLayoutEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;
    const measure = () => {
      const { width, height } = zone.getBoundingClientRect();
      const size = Math.floor(
        Math.min((width - 26) / GRID_COLS, (height - 34) / GRID_ROWS)
      );
      setCell(clamp(size, 34, 92));
      setTileH(
        window.innerHeight < 640 ? 54 : window.innerHeight < 760 ? 60 : 68
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(zone);
    return () => observer.disconnect();
  }, []);

  /* ----- Timer ----- */
  useEffect(() => {
    if (phase !== 'playing' || !state.startedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [phase, state.startedAt]);
  const elapsed =
    phase === 'playing'
      ? state.startedAt
        ? Math.max(0, now - state.startedAt)
        : 0
      : finalMs;

  /* ----- Conflict sound when a new rule breaks ----- */
  useEffect(() => {
    const seen = prevConflicts.current;
    const now = new Set(
      evaluation.conflicts.map((c) => `${c.rule}:${c.items.join(',')}`)
    );
    const fresh = evaluation.conflicts.find(
      (c) => !seen.has(`${c.rule}:${c.items.join(',')}`)
    );
    if (fresh && phase === 'playing') sfx.conflict(fresh.rule);
    prevConflicts.current = now;
  }, [evaluation.conflicts, phase]);

  /* ----- Win ----- */
  const submitSolve = useCallback(
    async (placements: Placement[], elapsedMs: number, moves: number) => {
      setSaving(true);
      try {
        const data = await postJson<GameResult>('/api/solve', {
          placements,
          elapsedMs,
          moves,
        });
        setResult(data);
        setFinalMs(data.timeMs);
      } catch (error) {
        if (!(error instanceof ApiFailure && error.status === 401)) {
          console.error('Could not save the solve', error);
          showToast('Could not save your bag. Your result is shown locally.');
        }
        setGuest({ timeMs: elapsedMs, moves });
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const win = useCallback(
    (placements: Placement[], moves: number, startedAt: number) => {
      const elapsedMs = Date.now() - startedAt;
      setFinalMs(elapsedMs);
      setPhase('stamping');
      sfx.stamp();
      window.setTimeout(() => sfx.win(), 260);
      void submitSolve(placements, elapsedMs, moves);
    },
    [submitSolve]
  );

  useEffect(() => {
    if (phase !== 'stamping') return;
    const id = window.setTimeout(() => {
      setPhase('done');
      setSheet('result');
    }, 1500);
    return () => window.clearTimeout(id);
  }, [phase]);

  /* ----- Board actions ----- */
  const markOnboarded = useCallback(() => {
    if (onboarded) return;
    setOnboarded(true);
    setFlag(ONBOARDED_KEY);
    setIntroRules(true);
    say(
      puzzle.request
        ? 'Nice! Mind the house rules above and the request below.'
        : 'Nice! Now mind the four house rules above.',
      'good',
      3200
    );
    window.setTimeout(() => setIntroRules(false), 1200);
  }, [onboarded, say, puzzle.request]);

  const place = useCallback(
    (p: Placement) => {
      dispatch({ type: 'place', p });
      markOnboarded();
      const next = [...state.placements.filter((q) => q.i !== p.i), p];
      if (evaluate(puzzle, next).solved) {
        win(next, state.moves + 1, state.startedAt ?? Date.now());
      } else {
        sfx.place();
      }
    },
    [
      dispatch,
      markOnboarded,
      puzzle,
      state.placements,
      state.moves,
      state.startedAt,
      win,
    ]
  );

  const anchorFor = (
    i: number,
    rot: boolean,
    r: number,
    c: number
  ): Placement | null => {
    const id = puzzle.items[i];
    if (!id) return null;
    const { w, h } = footprint(id, rot);
    return {
      i,
      rot,
      r: clamp(r - Math.floor((h - 1) / 2), 0, GRID_ROWS - h),
      c: clamp(c - Math.floor((w - 1) / 2), 0, GRID_COLS - w),
    };
  };

  const rotateSelected = useCallback(() => {
    const i = state.selected;
    if (i === null) return;
    const id = puzzle.items[i];
    if (!id) return;
    if (!canRotate(id)) {
      const upright = ITEMS[id].tags.includes('upright');
      if (upright) {
        // Show the rule: the item starts to tip over, then rocks back.
        sfx.conflict('upright');
        setTipped(i);
        window.setTimeout(() => setTipped(null), 600);
      } else sfx.invalid();
      say(
        upright
          ? `${ITEMS[id].name} has to stay upright.`
          : 'Turning it changes nothing.',
        'warn'
      );
      return;
    }
    sfx.rotate();
    dispatch({ type: 'rotate', i });
  }, [state.selected, puzzle.items, dispatch, say]);

  const tapTile = (i: number) => {
    if (state.selected === i) {
      rotateSelected();
      return;
    }
    sfx.pick();
    dispatch({ type: 'select', i });
  };

  const onCellTap = (r: number, c: number) => {
    if (dragRef.current || phase !== 'playing') return;
    const i = state.selected;
    if (i === null) {
      say('Pick an item from the receipt first.');
      return;
    }
    const candidate = anchorFor(i, Boolean(state.rot[i]), r, c);
    if (candidate && fits(puzzle, state.placements, candidate)) {
      place(candidate);
      setPreview(null);
    } else {
      sfx.invalid();
      say('No room there.', 'warn', 1400);
    }
  };

  const onHover = (r: number, c: number) => {
    if (dragRef.current || state.selected === null || phase !== 'playing')
      return;
    const candidate = anchorFor(
      state.selected,
      Boolean(state.rot[state.selected]),
      r,
      c
    );
    if (!candidate) return;
    setPreview({ ...candidate, ok: fits(puzzle, state.placements, candidate) });
  };

  /* ----- Drag and drop (mouse and touch) ----- */
  const touchLift = Math.round(cell * 0.9);

  const targetFor = useCallback(
    (d: Drag): Target | null => {
      const grid = gridRef.current;
      const id = puzzle.items[d.i];
      if (!grid || !id) return null;
      const rect = grid.getBoundingClientRect();
      const size = rect.width / GRID_COLS;
      const { w, h } = footprint(id, d.rot);
      const cx = d.x;
      const cy = d.y - (d.touch ? Math.round(size * 0.9) : 0);
      const inside =
        cx > rect.left - size * 0.6 &&
        cx < rect.right + size * 0.6 &&
        cy > rect.top - size * 0.9 &&
        cy < rect.bottom + size * 0.6;
      const placement: Placement = {
        i: d.i,
        rot: d.rot,
        r: clamp(Math.round((cy - rect.top) / size - h / 2), 0, GRID_ROWS - h),
        c: clamp(Math.round((cx - rect.left) / size - w / 2), 0, GRID_COLS - w),
      };
      return {
        inside,
        placement,
        ok: fits(puzzle, state.placements, placement),
      };
    },
    [puzzle, state.placements]
  );

  const beginDrag = (event: ReactPointerEvent, i: number) => {
    if (phase !== 'playing' || event.button !== 0) return;
    event.preventDefault();
    const placed = state.placements.find((p) => p.i === i);
    dragRef.current = {
      i,
      from: placed ? 'bag' : 'tray',
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      touch: event.pointerType !== 'mouse',
      rot: placed ? placed.rot : Boolean(state.rot[i]),
    };
  };

  // Keep the latest handlers reachable from the window listeners.
  const latest = useRef({ targetFor, place, tapTile, say, dispatch });
  useLayoutEffect(() => {
    latest.current = { targetFor, place, tapTile, say, dispatch };
  });

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      d.x = event.clientX;
      d.y = event.clientY;
      if (!d.moved && Math.hypot(d.x - d.startX, d.y - d.startY) > 6) {
        d.moved = true;
        sfx.pick();
        if (d.from === 'tray')
          latest.current.dispatch({ type: 'select', i: d.i });
      }
      if (!d.moved) return;
      setGhost({ ...d });
      const target = latest.current.targetFor(d);
      setPreview(
        target && target.inside ? { ...target.placement, ok: target.ok } : null
      );
    };
    const end = (event: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      d.x = event.clientX;
      d.y = event.clientY;
      // Let cell tap handlers see the drag first, then clear it.
      window.setTimeout(() => {
        dragRef.current = null;
      }, 0);
      setGhost(null);
      setPreview(null);
      const {
        targetFor: findTarget,
        place: doPlace,
        tapTile: tap,
        say: speak,
        dispatch: send,
      } = latest.current;
      if (!d.moved) {
        if (d.from === 'bag') {
          sfx.lift();
          send({ type: 'lift', i: d.i });
        } else {
          tap(d.i);
        }
        return;
      }
      const target = findTarget(d);
      if (target && target.inside) {
        if (target.ok) {
          doPlace(target.placement);
        } else {
          sfx.invalid();
          speak('No room there.', 'warn', 1400);
        }
      } else if (d.from === 'bag') {
        sfx.lift();
        send({ type: 'remove', i: d.i });
      } else {
        send({ type: 'select', i: d.i });
      }
    };
    const cancel = () => {
      dragRef.current = null;
      setGhost(null);
      setPreview(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', cancel);
    };
  }, []);

  /* ----- Keyboard shortcuts (desktop) ----- */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (phase !== 'playing' || sheet) return;
      if (event.key === 'r' || event.key === 'R') rotateSelected();
      else if (event.key === 'Escape') dispatch({ type: 'select', i: null });
      else if ((event.key === 'z' || event.key === 'Z') && !event.shiftKey)
        dispatch({ type: 'undo' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, sheet, rotateSelected, dispatch]);

  /* ----- Community actions ----- */
  const share = async () => {
    setShareState('busy');
    try {
      await postJson('/api/share');
      setShareState('done');
      sfx.place();
      showToast('Your time is in the comments!');
    } catch (error) {
      setShareState('idle');
      if (error instanceof ApiFailure && error.status === 409)
        setShareState('done');
      showToast(
        error instanceof ApiFailure
          ? error.message
          : 'Could not post your comment'
      );
    }
  };

  const join = async () => {
    setJoinState('busy');
    try {
      await postJson('/api/subscribe');
      setJoinState('done');
      showToast(`Welcome to r/${context.subredditName ?? 'the bag'}!`);
    } catch (error) {
      setJoinState('idle');
      showToast(
        error instanceof ApiFailure ? error.message : 'Could not join right now'
      );
    }
  };

  const vote = async (receiptId: string) => {
    setVoting(receiptId);
    try {
      const data = await postJson<VoteResponse>('/api/vote', { receiptId });
      sfx.pick();
      setResult((current) =>
        current
          ? { ...current, candidates: data.candidates, votedFor: data.votedFor }
          : current
      );
    } catch (error) {
      showToast(
        error instanceof ApiFailure ? error.message : 'Could not vote right now'
      );
    } finally {
      setVoting(null);
    }
  };

  /* ----- Status line ----- */
  const status: Flash = (() => {
    // A broken rule always beats a friendly hint.
    if (flash && (flash.tone === 'warn' || evaluation.conflicts.length === 0))
      return flash;
    if (offline && !server)
      return { text: 'Offline: your result will not be saved.', tone: 'warn' };
    if (phase !== 'playing')
      return {
        text: `All ${puzzle.items.length} items packed in ${formatDuration(finalMs)}!`,
        tone: 'good',
      };
    const first = evaluation.conflicts[0];
    if (first) return { text: conflictMessage(puzzle, first), tone: 'warn' };
    if (state.selected !== null) {
      const id = puzzle.items[state.selected];
      if (id) {
        return {
          text: `Tap the bag to drop the ${ITEMS[id].name.toLowerCase()}`,
          tone: 'info',
        };
      }
    }
    if (state.placements.length === 0)
      return { text: 'Tap an item on the receipt to pick it up', tone: 'info' };
    const left = puzzle.items.length - state.placements.length;
    return {
      text: `${left} item${left === 1 ? '' : 's'} left on the receipt`,
      tone: 'info',
    };
  })();

  const firstUnplaced = puzzle.items.findIndex((_, i) => !placedSet.has(i));
  const pulse =
    !onboarded && state.selected === null && state.placements.length === 0
      ? firstUnplaced
      : null;
  const selectedId =
    state.selected === null ? null : puzzle.items[state.selected];
  const ghostId = ghost ? puzzle.items[ghost.i] : undefined;
  const ghostSize = ghostId && ghost ? footprint(ghostId, ghost.rot) : null;
  const readOnly = phase !== 'playing';

  return (
    <div className="shell" style={{ ['--tile-h' as string]: `${tileH}px` }}>
      <header className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="wordmark">
            Pakia Pakia<em>!</em>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[12px] font-bold text-[var(--fg-soft)]">
            <span className="truncate">
              #{number} · {formatDay(day)}
            </span>
            <span className={`pill ${puzzle.difficulty}`}>
              {DIFFICULTY_LABELS[puzzle.difficulty]}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="timer" aria-label="Time">
            {formatDuration(elapsed)}
          </span>
          <button
            type="button"
            className="icon-btn"
            aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
            onClick={() => {
              setMuted(!muted);
              setMutedState(!muted);
              if (muted) sfx.tap();
            }}
          >
            <Icon name={muted ? 'soundOff' : 'soundOn'} />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="How to play"
            onClick={() => setSheet('help')}
          >
            <Icon name="help" />
          </button>
        </div>
      </header>

      <nav className="rules" aria-label="House rules">
        {RULES.map((rule) => (
          <button
            key={rule.id}
            type="button"
            className={`rule-chip${brokenRules.has(rule.id) ? ' broken' : ''}${introRules ? ' intro' : ''}`}
            onClick={() => {
              sfx.tap();
              say(rule.help, 'info', 3000);
            }}
            aria-label={`${rule.label}: ${rule.help}`}
          >
            {rule.icons.map((tag) => (
              <TagIcon key={tag} tag={tag} size={14} />
            ))}
            <span>{rule.label}</span>
          </button>
        ))}
      </nav>

      <div className="bag-zone" ref={zoneRef}>
        <BagGrid
          puzzle={puzzle}
          placements={state.placements}
          cell={cell}
          conflicts={conflictsByItem}
          hidden={ghost && ghost.from === 'bag' ? ghost.i : null}
          preview={preview}
          lastPlaced={state.lastPlaced}
          stamped={phase !== 'playing'}
          readOnly={readOnly}
          gridRef={gridRef}
          onCellTap={onCellTap}
          onHover={onHover}
          onLeave={() => {
            if (!dragRef.current) setPreview(null);
          }}
          onPiecePointerDown={beginDrag}
        />
      </div>

      <p
        className={`status m-0 ${status.tone}`}
        role="status"
        aria-live="polite"
      >
        {status.text}
      </p>

      <ItemTray
        puzzle={puzzle}
        placed={placedSet}
        selected={state.selected}
        rot={state.rot}
        pulse={pulse}
        requestBroken={brokenRules.has('request')}
        tipped={tipped}
        hidden={ghost && ghost.from === 'bag' ? ghost.i : null}
        onPointerDown={beginDrag}
      />

      {readOnly ? (
        <div className="controls !grid-cols-1">
          <button
            type="button"
            className="ctrl-btn primary"
            onClick={() => setSheet('result')}
            disabled={phase === 'stamping'}
          >
            <Icon name="results" />
            Results, votes and tomorrow’s customer
          </button>
        </div>
      ) : (
        <div className="controls">
          <button
            type="button"
            className="ctrl-btn primary"
            onClick={rotateSelected}
            disabled={!selectedId || !canRotate(selectedId)}
            aria-label="Rotate the item in hand"
          >
            <Icon name="rotate" />
            Rotate
          </button>
          <button
            type="button"
            className="ctrl-btn"
            onClick={() => {
              sfx.lift();
              dispatch({ type: 'undo' });
            }}
            disabled={state.history.length === 0}
          >
            <Icon name="undo" />
            Undo
          </button>
          <button
            type="button"
            className="ctrl-btn"
            onClick={() => {
              sfx.lift();
              dispatch({ type: 'clear' });
            }}
            disabled={state.placements.length === 0}
          >
            Empty bag
          </button>
        </div>
      )}

      {ghost && ghostId && ghostSize && (
        <div
          className="ghost"
          style={{
            left: ghost.x - (ghostSize.w * cell) / 2,
            top:
              ghost.y -
              (ghostSize.h * cell) / 2 -
              (ghost.touch ? touchLift : 0),
            width: ghostSize.w * cell,
            height: ghostSize.h * cell,
          }}
        >
          <div className="piece-inner">
            <ItemArt id={ghostId} rot={ghost.rot} />
          </div>
        </div>
      )}

      {sheet === 'help' && <HelpSheet onClose={() => setSheet(null)} />}
      {sheet === 'editor' && (
        <ReceiptEditor
          onClose={() => setSheet('result')}
          onSubmitted={() =>
            setResult((current) =>
              current
                ? { ...current, canWriteReceipt: false, submittedReceipt: true }
                : current
            )
          }
        />
      )}
      {sheet === 'result' && (
        <ResultCard
          day={day}
          number={number}
          puzzle={puzzle}
          result={result}
          guest={guest}
          loading={saving}
          subreddit={context.subredditName ?? null}
          shareState={shareState}
          joinState={joinState}
          voting={voting}
          onShare={() => void share()}
          onJoin={() => void join()}
          onVote={(id) => void vote(id)}
          onWrite={() => setSheet('editor')}
          onLogin={() => showLoginPrompt()}
          onOpenToday={(url) => navigateTo(url)}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
};
