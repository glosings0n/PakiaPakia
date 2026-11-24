import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addDays, dayNumber, formatDay } from '../src/shared/dates';
import { HOUSE_RECEIPTS, houseReceiptFor } from '../src/shared/puzzles';
import { checkReceipt } from '../src/shared/receipts';
import { rate, solve } from '../src/shared/solver';
import type { Placement, Puzzle } from '../src/shared/types';
import { bagSignature, evaluate, findConflicts } from '../src/shared/validator';

const puzzle = (items: Puzzle['items']): Puzzle => ({ title: 'Test', author: null, items, difficulty: 'easy' });

describe('house receipts', () => {
  it('covers every day from Dec 1 2026 to Jan 31 2027 (hackathon judging included)', () => {
    for (let day = '2026-12-01'; day <= '2027-01-31'; day = addDays(day, 1)) {
      assert.ok(
        HOUSE_RECEIPTS.some((r) => r.day === day),
        `missing receipt for ${day}`
      );
    }
  });

  it('has at least 15 receipts', () => {
    assert.ok(HOUSE_RECEIPTS.length >= 15);
  });

  for (const receipt of HOUSE_RECEIPTS) {
    it(`${receipt.day} "${receipt.title}" is solvable, rated ${receipt.difficulty}, and its solution passes the validator`, () => {
      const result = solve(receipt.items, { limit: 1 });
      assert.ok(result.first, 'solver found no bag');
      const p = puzzle(receipt.items);
      const evaluation = evaluate(p, result.first);
      assert.equal(evaluation.error, null);
      assert.deepEqual(evaluation.conflicts, []);
      assert.equal(evaluation.solved, true);
      assert.equal(rate(receipt.items).difficulty, receipt.difficulty);
      assert.ok(receipt.items.length >= 8 && receipt.items.length <= 10);
    });
  }

  it('falls back to a pool receipt outside the generated range', () => {
    const p = houseReceiptFor('2030-06-01');
    assert.ok(p.items.length > 0);
  });
});

describe('validator rules', () => {
  it('flags heavy items that do not touch the floor', () => {
    const p = puzzle(['soup']);
    assert.deepEqual(findConflicts(p, [{ i: 0, r: 3, c: 0, rot: false }]), [{ rule: 'heavy', items: [0] }]);
    assert.deepEqual(findConflicts(p, [{ i: 0, r: 4, c: 0, rot: false }]), []);
  });

  it('flags fragile items with anything above them in the same column', () => {
    const p = puzzle(['eggs', 'apples']);
    const placements: Placement[] = [
      { i: 0, r: 4, c: 0, rot: false },
      { i: 1, r: 1, c: 1, rot: false },
    ];
    assert.deepEqual(findConflicts(p, placements), [{ rule: 'fragile', items: [0, 1] }]);
    assert.deepEqual(findConflicts(p, [placements[0]!, { i: 1, r: 1, c: 2, rot: false }]), []);
  });

  it('flags cold items touching hot items, but not diagonally', () => {
    const p = puzzle(['icecream', 'coffee']);
    assert.equal(
      findConflicts(p, [
        { i: 0, r: 0, c: 0, rot: false },
        { i: 1, r: 0, c: 1, rot: false },
      ])[0]?.rule,
      'temperature'
    );
    assert.deepEqual(
      findConflicts(p, [
        { i: 0, r: 0, c: 0, rot: false },
        { i: 1, r: 1, c: 1, rot: false },
      ]),
      []
    );
  });

  it('flags upright items that were turned on their side', () => {
    const p = puzzle(['milk']);
    assert.equal(findConflicts(p, [{ i: 0, r: 0, c: 0, rot: true }])[0]?.rule, 'upright');
  });

  it('rejects overlaps, out-of-bounds and duplicate placements', () => {
    const p = puzzle(['apples', 'cheese']);
    assert.notEqual(
      evaluate(p, [
        { i: 0, r: 0, c: 0, rot: false },
        { i: 1, r: 0, c: 0, rot: false },
      ]).error,
      null
    );
    assert.notEqual(evaluate(p, [{ i: 0, r: 5, c: 0, rot: false }]).error, null);
    assert.notEqual(
      evaluate(p, [
        { i: 0, r: 0, c: 0, rot: false },
        { i: 0, r: 1, c: 0, rot: false },
      ]).error,
      null
    );
  });

  it('gives the same signature to bags that only swap identical items', () => {
    const p = puzzle(['apples', 'apples']);
    const a = bagSignature(p, [
      { i: 0, r: 0, c: 0, rot: false },
      { i: 1, r: 0, c: 1, rot: false },
    ]);
    const b = bagSignature(p, [
      { i: 1, r: 0, c: 0, rot: false },
      { i: 0, r: 0, c: 1, rot: false },
    ]);
    assert.equal(a, b);
    assert.equal(a.length, 25);
  });
});

describe('community receipts', () => {
  it('accepts a solvable receipt and rates it', () => {
    const result = checkReceipt({
      title: 'Hosting my in-laws',
      items: ['turkey', 'wine', 'wine', 'cake', 'cheese', 'bread', 'coffee', 'apples'],
    });
    assert.equal(result.ok, true);
  });

  it('rejects impossible receipts', () => {
    const result = checkReceipt({
      title: 'Too many melons',
      items: ['watermelon', 'watermelon', 'watermelon', 'eggs', 'eggs', 'eggs', 'chips', 'chips'],
    });
    assert.equal(result.ok, false);
  });

  it('rejects bad titles', () => {
    assert.equal(checkReceipt({ title: 'x', items: ['apples'] }).ok, false);
    assert.equal(checkReceipt({ title: 'visit https://spam.example', items: ['apples'] }).ok, false);
  });
});

describe('dates', () => {
  it('numbers days from launch and formats them', () => {
    assert.equal(dayNumber('2026-11-20'), 1);
    assert.equal(dayNumber('2026-12-09'), 20);
    assert.equal(formatDay('2026-12-09'), 'Wed, Dec 9');
  });
});
