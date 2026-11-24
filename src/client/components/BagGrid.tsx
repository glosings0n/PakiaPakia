import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { footprint } from '../../shared/items';
import type { Placement, Puzzle, RuleId } from '../../shared/types';
import { GRID_COLS, GRID_ROWS } from '../../shared/types';
import { ItemArt, TagBadges } from './Art';

export type Preview = {
  i: number;
  r: number;
  c: number;
  rot: boolean;
  ok: boolean;
};

type Props = {
  puzzle: Puzzle;
  placements: Placement[];
  cell: number;
  conflicts: Map<number, RuleId[]>;
  hidden: number | null;
  preview: Preview | null;
  lastPlaced: number | null;
  stamped: boolean;
  readOnly: boolean;
  gridRef: RefObject<HTMLDivElement | null>;
  onCellTap: (r: number, c: number) => void;
  onHover: (r: number, c: number) => void;
  onLeave: () => void;
  onPiecePointerDown: (event: ReactPointerEvent, i: number) => void;
};

/** The 5x5 paper bag. Row 0 is the top, the last row is the floor. */
export const BagGrid = ({
  puzzle,
  placements,
  cell,
  conflicts,
  hidden,
  preview,
  lastPlaced,
  stamped,
  readOnly,
  gridRef,
  onCellTap,
  onHover,
  onLeave,
  onPiecePointerDown,
}: Props) => {
  const previewSize = preview
    ? footprint(puzzle.items[preview.i] ?? 'apples', preview.rot)
    : null;
  return (
    <div className="bag" style={{ ['--cell' as string]: `${cell}px` }}>
      <div
        className="grid"
        ref={gridRef}
        role="grid"
        aria-label="Grocery bag, 5 by 5"
        onPointerLeave={onLeave}
      >
        {Array.from({ length: GRID_ROWS * GRID_COLS }, (_, index) => {
          const r = Math.floor(index / GRID_COLS);
          const c = index % GRID_COLS;
          return (
            <div
              key={index}
              role="gridcell"
              className={`cell${r === GRID_ROWS - 1 ? ' floor' : ''}`}
              onPointerUp={(e) => {
                if (e.button === 0 && !readOnly) onCellTap(r, c);
              }}
              onPointerMove={(e) => {
                if (e.pointerType === 'mouse' && !readOnly) onHover(r, c);
              }}
            />
          );
        })}

        {preview && previewSize && (
          <div
            className={`shadow-cell ${preview.ok ? 'ok' : 'bad'}`}
            style={{
              left: preview.c * cell + 2,
              top: preview.r * cell + 2,
              width: previewSize.w * cell - 4,
              height: previewSize.h * cell - 4,
            }}
          />
        )}

        {placements.map((p) => {
          if (p.i === hidden) return null;
          const id = puzzle.items[p.i];
          if (!id) return null;
          const { w, h } = footprint(id, p.rot);
          const broken = conflicts.get(p.i);
          return (
            <div
              key={p.i}
              className={`piece${broken ? ' conflict' : ''}${lastPlaced === p.i ? ' dropped' : ''}`}
              style={{
                left: p.c * cell,
                top: p.r * cell,
                width: w * cell,
                height: h * cell,
              }}
              onPointerDown={(e) => {
                if (!readOnly) onPiecePointerDown(e, p.i);
              }}
              aria-label={`${id} in the bag`}
            >
              <div className="piece-inner">
                <ItemArt id={id} rot={p.rot} />
                <TagBadges id={id} />
                {broken && <span className="alert-badge">!</span>}
              </div>
            </div>
          );
        })}
      </div>
      <span className="floor-label">Floor</span>
      {stamped && (
        <div className="stamp">
          <span>Pakia!</span>
        </div>
      )}
    </div>
  );
};
