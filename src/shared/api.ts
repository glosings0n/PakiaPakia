import type { SpecialRequest } from './requests';
import type { Difficulty, ItemId, Placement, Puzzle } from './types';

export type UserSummary = {
  loggedIn: boolean;
  username: string | null;
  streak: number;
  maxStreak: number;
  solved: number;
};

export type LeaderRow = {
  rank: number;
  username: string;
  avatar: string | null;
  timeMs: number;
  moves: number;
  me: boolean;
};

/** How the subreddit packed today's bag, revealed only after solving. */
export type CommunityBag = {
  /** Most popular item type per cell (25 entries, row by row). */
  cells: (ItemId | null)[];
  /** Share of your filled cells that match the most popular layout. */
  matchPct: number;
  /** How many solvers packed exactly the same bag as you (you included). */
  sameBagCount: number;
  totalBags: number;
  /**
   * Your least common choice: the item whose exact spot the fewest other solvers used.
   * Null when you are the only solver.
   */
  rareSpot: { item: ItemId; others: number } | null;
};

export type ReceiptCandidate = {
  id: string;
  title: string;
  author: string;
  items: ItemId[];
  difficulty: Difficulty;
  request: SpecialRequest | null;
  note: string | null;
  votes: number;
};

export type GameResult = {
  day: string;
  number: number;
  timeMs: number;
  moves: number;
  placements: Placement[];
  rank: number;
  totalSolves: number;
  /** Percentage of other solvers you were faster than. */
  beatPct: number;
  streak: number;
  maxStreak: number;
  leaderboard: LeaderRow[];
  community: CommunityBag;
  candidates: ReceiptCandidate[];
  votedFor: string | null;
  canWriteReceipt: boolean;
  submittedReceipt: boolean;
  shared: boolean;
  isToday: boolean;
  todayPostUrl: string | null;
};

export type GameInit = {
  day: string;
  number: number;
  puzzle: Puzzle;
  isToday: boolean;
  user: UserSummary;
  result: GameResult | null;
  solvesToday: number;
};

export type SolveRequest = {
  placements: Placement[];
  elapsedMs: number;
  moves: number;
};
export type VoteRequest = { receiptId: string };
export type VoteResponse = {
  candidates: ReceiptCandidate[];
  votedFor: string | null;
};
export type ReceiptRequest = {
  title: string;
  items: ItemId[];
  request: SpecialRequest | null;
  note: string;
};
export type ReceiptResponse =
  { ok: true; difficulty: Difficulty } | { ok: false; reason: string };

export type SplashInfo = {
  solvesToday: number;
  solved: boolean;
  timeMs: number | null;
  streak: number;
};

export type ApiError = { status: 'error'; message: string };
