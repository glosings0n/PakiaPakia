import { useEffect, useState } from 'react';
import type { GameResult, LeaderRow, ReceiptCandidate } from '../../shared/api';
import { formatDay, formatDuration, msUntilNextDay } from '../../shared/dates';
import { describeRequest } from '../../shared/requests';
import { revealFor } from '../../shared/reveal';
import type { Puzzle } from '../../shared/types';
import { DIFFICULTY_LABELS } from '../../shared/types';
import { Icon, ItemArt } from './Art';

export type GuestResult = { timeMs: number; moves: number };

type Tab = 'tomorrow' | 'hivemind' | 'top';

type Props = {
  day: string;
  number: number;
  puzzle: Puzzle;
  result: GameResult | null;
  guest: GuestResult | null;
  loading: boolean;
  subreddit: string | null;
  shareState: 'idle' | 'busy' | 'done';
  joinState: 'idle' | 'busy' | 'done';
  voting: string | null;
  onShare: () => void;
  onJoin: () => void;
  onVote: (id: string) => void;
  onWrite: () => void;
  onLogin: () => void;
  onOpenToday: (url: string) => void;
  onClose: () => void;
};

const Countdown = () => {
  const [ms, setMs] = useState(() => msUntilNextDay());
  useEffect(() => {
    const id = window.setInterval(() => setMs(msUntilNextDay()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return (
    <span className="tabular-nums">
      {h}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
};

const Avatar = ({ row }: { row: LeaderRow }) => {
  const [broken, setBroken] = useState(false);
  return (
    <span className="avatar">
      {row.avatar && !broken ? (
        <img src={row.avatar} alt="" onError={() => setBroken(true)} />
      ) : (
        row.username.slice(0, 1).toUpperCase()
      )}
    </span>
  );
};

const CandidateCard = ({
  candidate,
  voted,
  busy,
  onVote,
}: {
  candidate: ReceiptCandidate;
  voted: boolean;
  busy: boolean;
  onVote: () => void;
}) => (
  <div className={`candidate${voted ? ' voted' : ''}`}>
    <div className="min-w-0 flex-1">
      <div className="truncate text-[14px] font-extrabold">
        “{candidate.title}”
      </div>
      <div className="muted mb-1 truncate text-[11px]">
        u/{candidate.author} ·{' '}
        <span className={`pill ${candidate.difficulty}`}>
          {DIFFICULTY_LABELS[candidate.difficulty]}
        </span>
      </div>
      {candidate.request && (
        <p className="request-line !mb-1 !text-[14px]">
          <Icon name="request" size={14} />
          <span>
            {describeRequest(candidate.request)}
            {candidate.note && (
              <span className="request-note"> “{candidate.note}”</span>
            )}
          </span>
        </p>
      )}
      <div className="mini-items">
        {candidate.items.map((id, k) => (
          <span key={k}>
            <ItemArt id={id} className="art" />
          </span>
        ))}
      </div>
    </div>
    <button
      type="button"
      className={`ctrl-btn ${voted ? '' : 'primary'} w-[74px] shrink-0 flex-col !gap-0 !text-[12px]`}
      onClick={onVote}
      disabled={busy || voted}
      aria-label={voted ? 'Your vote' : `Vote for ${candidate.title}`}
    >
      <Icon name={voted ? 'check' : 'vote'} size={16} />
      <span>
        {candidate.votes} vote{candidate.votes === 1 ? '' : 's'}
      </span>
    </button>
  </div>
);

/** How unusual the player's bag is: the moment worth sharing. */
const RevealLine = ({ result }: { result: GameResult }) => {
  const reveal = revealFor(result.community);
  if (!reveal) return null;
  const rare = result.community.rareSpot;
  return (
    <div className="reveal" role="status">
      {rare && (
        <span className="reveal-art" aria-hidden="true">
          <ItemArt id={rare.item} className="art" />
        </span>
      )}
      <div className="min-w-0">
        <p className="reveal-head">{reveal.headline}</p>
        {reveal.detail && <p className="reveal-detail">{reveal.detail}</p>}
      </div>
    </div>
  );
};

/** The single end screen: stats, the community loop, and tomorrow's customer. */
export const ResultCard = (props: Props) => {
  const { result, guest, puzzle } = props;
  const [tab, setTab] = useState<Tab>('tomorrow');
  const timeMs = result?.timeMs ?? guest?.timeMs ?? 0;
  const moves = result?.moves ?? guest?.moves ?? 0;

  return (
    <div
      className="backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Results"
    >
      <div className="sheet flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[12px] font-extrabold text-[var(--accent)]">
              Pakia Pakia! #{props.number} · {formatDay(props.day)}
            </div>
            <h2 className="truncate">“{puzzle.title}” is packed!</h2>
          </div>
          <button
            type="button"
            className="icon-btn shrink-0"
            onClick={props.onClose}
            aria-label="Look at my bag"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="stats">
          <div className="stat">
            <b>{formatDuration(timeMs)}</b>
            <small>Time</small>
          </div>
          <div className="stat">
            <b>{moves}</b>
            <small>Moves</small>
          </div>
          <div className="stat">
            <b>{result ? result.streak : '-'}</b>
            <small>Streak</small>
          </div>
          <div className="stat">
            <b>{result ? `#${result.rank}` : '-'}</b>
            <small>{result ? `of ${result.totalSolves}` : 'Rank'}</small>
          </div>
        </div>

        {props.loading && (
          <p className="toast-line muted">Saving your bag...</p>
        )}

        {!result && !props.loading && (
          <div className="flex flex-col gap-2">
            <p className="toast-line">
              Log in to save your streak, join the leaderboard and vote on
              tomorrow’s customer.
            </p>
            <button type="button" className="big-btn" onClick={props.onLogin}>
              Log in to Reddit
            </button>
          </div>
        )}

        {result && (
          <>
            <RevealLine result={result} />
            <p className="toast-line">
              {result.totalSolves > 1
                ? `Faster than ${result.beatPct}% of ${props.subreddit ? `r/${props.subreddit}` : 'baggers'} today`
                : 'First bag of the day. The bar is yours to set!'}
            </p>

            {result.todayPostUrl && (
              <button
                type="button"
                className="big-btn secondary"
                onClick={() => props.onOpenToday(result.todayPostUrl ?? '')}
              >
                Open today’s bag
              </button>
            )}

            <div className="tabs" role="tablist">
              {(
                [
                  ['tomorrow', 'Next customer'],
                  ['hivemind', 'Hivemind'],
                  ['top', 'Top baggers'],
                ] as const
              ).map(([id, text]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                >
                  {text}
                </button>
              ))}
            </div>

            {tab === 'tomorrow' && (
              <div className="flex flex-col gap-2">
                <p className="m-0 text-[13px] font-bold">
                  The most voted receipt becomes tomorrow’s puzzle, credited to
                  its author.
                </p>
                {result.candidates.length === 0 && (
                  <p className="muted m-0 text-[13px]">
                    No receipts in the running yet. Yours could be the first!
                  </p>
                )}
                {result.candidates.map((candidate) => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    voted={result.votedFor === candidate.id}
                    busy={props.voting !== null}
                    onVote={() => props.onVote(candidate.id)}
                  />
                ))}
                <button
                  type="button"
                  className="big-btn secondary"
                  onClick={props.onWrite}
                  disabled={!result.canWriteReceipt}
                >
                  {result.canWriteReceipt
                    ? 'Write tomorrow’s receipt'
                    : 'Your receipt is in the running'}
                </button>
              </div>
            )}

            {tab === 'hivemind' && (
              <div className="flex flex-col items-center gap-2">
                <p className="m-0 text-center text-[13px] font-bold">
                  The bag{' '}
                  {props.subreddit ? `r/${props.subreddit}` : 'everyone'}{' '}
                  packed, cell by most popular cell
                </p>
                <div
                  className="hive"
                  aria-label="Most popular item in each cell"
                >
                  {result.community.cells.map((id, cell) => (
                    <div key={cell}>
                      {id ? <ItemArt id={id} className="art" /> : null}
                    </div>
                  ))}
                </div>
                <p className="m-0 text-center text-[14px]">
                  Your bag matches the hivemind{' '}
                  <b>{result.community.matchPct}%</b>.{' '}
                  {result.community.sameBagCount <= 1
                    ? 'Nobody else packed it quite like you.'
                    : `${result.community.sameBagCount} of ${result.community.totalBags} baggers packed the exact same bag.`}
                </p>
              </div>
            )}

            {tab === 'top' && (
              <div>
                {result.leaderboard.map((row) => (
                  <div
                    key={row.rank}
                    className={`lb-row${row.me ? ' me' : ''}`}
                  >
                    <b>#{row.rank}</b>
                    <Avatar row={row} />
                    <span className="truncate">u/{row.username}</span>
                    <span className="muted">{row.moves} mv</span>
                    <b>{formatDuration(row.timeMs)}</b>
                  </div>
                ))}
                {!result.leaderboard.some((row) => row.me) && (
                  <p className="muted m-0 mt-2 text-center text-[13px]">
                    You are #{result.rank} of {result.totalSolves}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="big-btn"
                onClick={props.onShare}
                disabled={result.shared || props.shareState !== 'idle'}
              >
                {result.shared || props.shareState === 'done'
                  ? 'Shared'
                  : props.shareState === 'busy'
                    ? 'Posting...'
                    : 'Share my time'}
              </button>
              <button
                type="button"
                className="big-btn secondary"
                onClick={props.onJoin}
                disabled={props.joinState !== 'idle'}
              >
                {props.joinState === 'done'
                  ? 'Joined'
                  : props.joinState === 'busy'
                    ? 'Joining...'
                    : `Join ${props.subreddit ? `r/${props.subreddit}` : 'us'}`}
              </button>
            </div>
          </>
        )}

        <p className="muted m-0 text-center text-[12px]">
          Next bag in <Countdown />
        </p>
      </div>
    </div>
  );
};
