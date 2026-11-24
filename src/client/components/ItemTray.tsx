import type { PointerEvent as ReactPointerEvent } from 'react';
import { ITEMS } from '../../shared/items';
import type { Puzzle } from '../../shared/types';
import { Icon, ItemArt, TagBadges } from './Art';

type Props = {
  puzzle: Puzzle;
  placed: Set<number>;
  selected: number | null;
  rot: Record<number, boolean>;
  pulse: number | null;
  hidden: number | null;
  onPointerDown: (event: ReactPointerEvent, i: number) => void;
};

/** The day's receipt: every grocery that has to go in the bag. */
export const ItemTray = ({
  puzzle,
  placed,
  selected,
  rot,
  pulse,
  hidden,
  onPointerDown,
}: Props) => (
  <section className="receipt" aria-label="Receipt">
    <div className="receipt-head">
      <span className="receipt-title">{puzzle.title}</span>
      <span className="receipt-author">
        {puzzle.author ? `by u/${puzzle.author}` : 'house receipt'}
      </span>
    </div>
    <div className="tray">
      {puzzle.items.map((id, i) => {
        const isPlaced = placed.has(i) || hidden === i;
        const classes = ['tile'];
        if (isPlaced) classes.push('placed');
        if (selected === i) classes.push('selected');
        if (pulse === i) classes.push('pulse');
        return (
          <button
            key={i}
            type="button"
            className={classes.join(' ')}
            aria-label={`${ITEMS[id].name}${ITEMS[id].tags.length ? `, ${ITEMS[id].tags.join(', ')}` : ''}${isPlaced ? ', in the bag' : ''}`}
            aria-pressed={selected === i}
            onPointerDown={(e) => onPointerDown(e, i)}
          >
            <span className="tile-art">
              <ItemArt
                id={id}
                rot={Boolean(rot[i]) && selected === i}
                className="art"
              />
            </span>
            <span className="tile-name">{ITEMS[id].name}</span>
            <TagBadges id={id} />
            {placed.has(i) && (
              <span className="tile-check">
                <Icon name="check" size={12} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  </section>
);
