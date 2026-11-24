import { ITEMS } from '../shared/items';
import { describeRequest } from '../shared/requests';
import type { Conflict, Puzzle, RuleId, Tag } from '../shared/types';

export type RuleInfo = {
  id: RuleId;
  label: string;
  icons: Tag[];
  help: string;
};

export const RULES: RuleInfo[] = [
  {
    id: 'heavy',
    label: 'Floor',
    icons: ['heavy'],
    help: 'Heavy items must sit on the floor of the bag.',
  },
  {
    id: 'fragile',
    label: 'On top',
    icons: ['fragile'],
    help: 'Fragile items need nothing stacked above them.',
  },
  {
    id: 'temperature',
    label: 'Apart',
    icons: ['cold', 'hot'],
    help: 'Cold and hot items cannot touch sides.',
  },
  {
    id: 'upright',
    label: 'Upright',
    icons: ['upright'],
    help: 'Upright items cannot be turned on their side.',
  },
];

const nameOf = (puzzle: Puzzle, index: number | undefined): string => {
  const id = index === undefined ? undefined : puzzle.items[index];
  return id ? ITEMS[id].name : 'Something';
};

const lower = (puzzle: Puzzle, i: number | undefined) =>
  nameOf(puzzle, i).toLowerCase();

/** One short, human sentence per broken rule. */
export const conflictMessage = (puzzle: Puzzle, conflict: Conflict): string => {
  const [a, b] = conflict.items;
  switch (conflict.rule) {
    case 'heavy':
      return `Too heavy to float: put the ${lower(puzzle, a)} on the floor.`;
    case 'fragile':
      return `Crushed! ${nameOf(puzzle, b)} on top of the ${lower(puzzle, a)}.`;
    case 'temperature':
      return `Melting! ${nameOf(puzzle, a)} right next to the ${lower(puzzle, b)}.`;
    case 'upright':
      return `Keep the ${lower(puzzle, a)} standing up.`;
    case 'request':
      return puzzle.request
        ? `The customer asked: ${describeRequest(puzzle.request)}`
        : 'The customer is not happy with this bag.';
  }
};
