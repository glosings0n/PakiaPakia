import { useEffect, useMemo, useReducer } from 'react';
import type { Placement, Puzzle } from '../../shared/types';
import { evaluate } from '../../shared/validator';
import { load, save } from '../utils/storage';

export type BoardState = {
  placements: Placement[];
  /** Item instance currently "in hand". */
  selected: number | null;
  /** Orientation of each item when it is picked up next. */
  rot: Record<number, boolean>;
  history: Placement[][];
  moves: number;
  startedAt: number | null;
  /** Last dropped item, used for the drop animation. */
  lastPlaced: number | null;
};

type Action =
  | { type: 'select'; i: number | null }
  | { type: 'rotate'; i: number }
  | { type: 'place'; p: Placement }
  | { type: 'lift'; i: number }
  | { type: 'remove'; i: number }
  | { type: 'undo' }
  | { type: 'clear' }
  | { type: 'restore'; placements: Placement[] };

const without = (list: Placement[], i: number) => list.filter((p) => p.i !== i);

const reducer = (state: BoardState, action: Action): BoardState => {
  switch (action.type) {
    case 'select':
      return { ...state, selected: action.i };
    case 'rotate':
      return {
        ...state,
        rot: { ...state.rot, [action.i]: !state.rot[action.i] },
      };
    case 'place': {
      const placements = [...without(state.placements, action.p.i), action.p];
      return {
        ...state,
        placements,
        history: [...state.history, state.placements].slice(-50),
        selected: null,
        rot: { ...state.rot, [action.p.i]: action.p.rot },
        moves: state.moves + 1,
        startedAt: state.startedAt ?? Date.now(),
        lastPlaced: action.p.i,
      };
    }
    case 'lift': {
      const current = state.placements.find((p) => p.i === action.i);
      if (!current) return { ...state, selected: action.i };
      return {
        ...state,
        placements: without(state.placements, action.i),
        history: [...state.history, state.placements].slice(-50),
        selected: action.i,
        rot: { ...state.rot, [action.i]: current.rot },
        lastPlaced: null,
      };
    }
    case 'remove':
      if (!state.placements.some((p) => p.i === action.i)) return state;
      return {
        ...state,
        placements: without(state.placements, action.i),
        history: [...state.history, state.placements].slice(-50),
        selected: null,
        lastPlaced: null,
      };
    case 'undo': {
      const previous = state.history[state.history.length - 1];
      if (!previous) return state;
      return {
        ...state,
        placements: previous,
        history: state.history.slice(0, -1),
        selected: null,
        lastPlaced: null,
      };
    }
    case 'clear':
      if (state.placements.length === 0) return state;
      return {
        ...state,
        placements: [],
        history: [...state.history, state.placements].slice(-50),
        selected: null,
        lastPlaced: null,
      };
    case 'restore':
      return {
        ...state,
        placements: action.placements,
        selected: null,
        history: [],
        lastPlaced: null,
      };
  }
};

type SavedProgress = {
  placements: Placement[];
  moves: number;
  startedAt: number | null;
};

const isSavedProgress = (v: unknown): v is SavedProgress =>
  typeof v === 'object' &&
  v !== null &&
  'placements' in v &&
  Array.isArray(v.placements) &&
  'moves' in v &&
  typeof v.moves === 'number';

/** Board state for one puzzle, persisted locally so a half-packed bag survives a reload. */
export const useBoard = (
  day: string,
  puzzle: Puzzle,
  finished: Placement[] | null
) => {
  const storageKey = `pakia:progress:${day}:${puzzle.items.join(',')}`;

  const [state, dispatch] = useReducer(reducer, null, (): BoardState => {
    const saved = finished ? null : load(storageKey, isSavedProgress);
    const placements =
      finished ??
      (saved && !evaluate(puzzle, saved.placements).error
        ? saved.placements
        : []);
    return {
      placements,
      selected: null,
      rot: Object.fromEntries(placements.map((p) => [p.i, p.rot])),
      history: [],
      moves: saved?.moves ?? placements.length,
      startedAt: saved?.startedAt ?? null,
      lastPlaced: null,
    };
  });

  useEffect(() => {
    save(storageKey, {
      placements: state.placements,
      moves: state.moves,
      startedAt: state.startedAt,
    });
  }, [storageKey, state.placements, state.moves, state.startedAt]);

  const evaluation = useMemo(
    () => evaluate(puzzle, state.placements),
    [puzzle, state.placements]
  );

  return { state, dispatch, evaluation };
};
