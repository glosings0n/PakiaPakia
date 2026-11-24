import { memo } from 'react';
import { ITEMS } from '../../shared/items';
import type { ItemId, Tag } from '../../shared/types';
import { itemSvg } from '../art/items';
import { iconMarkup, type IconName } from '../icons';

const cache = new Map<string, string>();
const cachedItemSvg = (id: ItemId, rot: boolean): string => {
  const key = `${id}:${rot ? 1 : 0}`;
  let markup = cache.get(key);
  if (!markup) {
    markup = itemSvg(id, rot);
    cache.set(key, markup);
  }
  return markup;
};

/** Renders trusted, locally generated SVG markup. */
export const Svg = memo(function Svg({
  markup,
  className,
}: {
  markup: string;
  className?: string;
}) {
  return (
    <span className={className} dangerouslySetInnerHTML={{ __html: markup }} />
  );
});

export const ItemArt = memo(function ItemArt({
  id,
  rot = false,
  className = 'art',
}: {
  id: ItemId;
  rot?: boolean;
  className?: string;
}) {
  return <Svg className={className} markup={cachedItemSvg(id, rot)} />;
});

export const TagIcon = memo(function TagIcon({
  tag,
  size = 14,
}: {
  tag: Tag;
  size?: number;
}) {
  return (
    <Svg
      className={`hi ico-${tag}`}
      markup={iconMarkup(tag, size, size <= 12 ? 2.4 : 2)}
    />
  );
});

export const TagBadges = memo(function TagBadges({ id }: { id: ItemId }) {
  const tags = ITEMS[id].tags;
  if (tags.length === 0) return null;
  return (
    <div className="badges" aria-hidden="true">
      {tags.map((tag) => (
        <span key={tag} className={`badge ${tag}`}>
          <TagIcon tag={tag} size={10} />
        </span>
      ))}
    </div>
  );
});

/** Generic UI icon (Hugeicons, see ../icons.ts). */
export const Icon = memo(function Icon({
  name,
  size = 18,
}: {
  name: IconName;
  size?: number;
}) {
  return <Svg className="hi" markup={iconMarkup(name, size)} />;
});
