import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addDays, dayNumber, formatDay } from '../src/shared/dates';
import { HOUSE_RECEIPTS, houseReceiptFor } from '../src/shared/puzzles';
import { checkReceipt, MISSING_REQUEST } from '../src/shared/receipts';
import {
  describeRequest,
  isSpecialRequest,
  pairOk,
  requestProblem,
  touching,
  unaryOk,
  type SpecialRequest,
} from '../src/shared/requests';
import { RATING_CAP, rate, solve } from '../src/shared/solver';
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
    it(`${receipt.day} "${receipt.title}" is solvable with its request, rated ${receipt.difficulty}, and its solution passes the validator`, () => {
      const { request } = receipt;
      assert.ok(isSpecialRequest(request), 'missing special request');
      assert.equal(requestProblem(receipt.items, request), null);
      const result = solve(receipt.items, { limit: 1, request });
      assert.ok(result.first, 'solver found no bag');
      const p: Puzzle = { ...puzzle(receipt.items), request };
      const evaluation = evaluate(p, result.first);
      assert.equal(evaluation.error, null);
      assert.deepEqual(evaluation.conflicts, []);
      assert.equal(evaluation.solved, true);
      const rating = rate(receipt.items, request);
      assert.equal(rating.difficulty, receipt.difficulty);
      const base = rate(receipt.items);
      if (base.solutions < RATING_CAP)
        assert.ok(rating.solutions < base.solutions, 'request changes nothing');
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

describe('special requests', () => {
  const box = (top: number, left: number, h = 1, w = 1) => ({
    top,
    bottom: top + h - 1,
    left,
    right: left + w - 1,
  });

  it('reads like a customer', () => {
    assert.equal(describeRequest({ kind: 'top', item: 'cake' }), 'Put the birthday cake on the top row.');
    assert.equal(
      describeRequest({ kind: 'apart', item: 'bread', other: 'milk' }),
      'Keep the bread away from the milk.'
    );
  });

  it('validates its shape', () => {
    assert.equal(isSpecialRequest({ kind: 'top', item: 'cake' }), true);
    assert.equal(isSpecialRequest({ kind: 'top', item: 'cake', other: 'milk' }), false);
    assert.equal(isSpecialRequest({ kind: 'above', item: 'cake' }), false);
    assert.equal(isSpecialRequest({ kind: 'above', item: 'cake', other: 'cake' }), false);
    assert.equal(isSpecialRequest({ kind: 'nope', item: 'cake' }), false);
  });

  it('only names items that are on the receipt once', () => {
    const items: Puzzle['items'] = ['wine', 'wine', 'cake'];
    assert.equal(requestProblem(items, { kind: 'top', item: 'cake' }), null);
    assert.notEqual(requestProblem(items, { kind: 'top', item: 'wine' }), null);
    assert.notEqual(requestProblem(items, { kind: 'top', item: 'milk' }), null);
    assert.notEqual(requestProblem(items, { kind: 'apart', item: 'cake', other: 'wine' }), null);
  });

  it('measures the bag correctly', () => {
    assert.equal(unaryOk('top', box(0, 3)), true);
    assert.equal(unaryOk('top', box(1, 3)), false);
    assert.equal(unaryOk('offFloor', box(4, 0)), false);
    assert.equal(unaryOk('offFloor', box(2, 0, 2)), true);
    assert.equal(unaryOk('middle', box(1, 1, 2, 2)), true);
    assert.equal(unaryOk('middle', box(0, 0, 2, 2)), false);
    assert.equal(touching(box(0, 0), box(0, 1)), true);
    assert.equal(touching(box(0, 0), box(1, 1)), false);
    assert.equal(pairOk('above', box(0, 0), box(1, 3)), true);
    assert.equal(pairOk('above', box(0, 0, 2), box(1, 3)), false);
    assert.equal(pairOk('apart', box(0, 0), box(0, 2)), true);
    assert.equal(pairOk('together', box(0, 0), box(0, 2)), false);
  });

  it('flags a broken request in the validator', () => {
    const p: Puzzle = { ...puzzle(['apples', 'bread']), request: { kind: 'top', item: 'apples' } };
    const low: Placement[] = [{ i: 0, r: 4, c: 0, rot: false }];
    assert.ok(findConflicts(p, low).some((c) => c.rule === 'request'));
    const high: Placement[] = [{ i: 0, r: 0, c: 0, rot: false }];
    assert.ok(!findConflicts(p, high).some((c) => c.rule === 'request'));
  });

  it('waits until both items of a pair are in the bag', () => {
    const p: Puzzle = {
      ...puzzle(['apples', 'bread']),
      request: { kind: 'together', item: 'apples', other: 'bread' },
    };
    const one: Placement[] = [{ i: 0, r: 4, c: 0, rot: false }];
    assert.ok(!findConflicts(p, one).some((c) => c.rule === 'request'));
    const far: Placement[] = [
      { i: 0, r: 4, c: 0, rot: false },
      { i: 1, r: 0, c: 3, rot: false },
    ];
    assert.deepEqual(findConflicts(p, far).find((c) => c.rule === 'request')?.items, [0, 1]);
  });

  it('never makes the solver count more bags', () => {
    for (const receipt of HOUSE_RECEIPTS.slice(0, 12)) {
      const base = solve(receipt.items, { limit: RATING_CAP });
      const cut = solve(receipt.items, { limit: RATING_CAP, request: receipt.request });
      assert.ok(cut.count <= base.count);
    }
  });
});

describe('community receipts', () => {
  const inLaws: Puzzle['items'] = ['turkey', 'wine', 'wine', 'cake', 'cheese', 'bread', 'coffee', 'apples'];
  const firstValid = (title: string, items: Puzzle['items'], note = '') => {
    const singles = items.filter((id) => items.filter((x) => x === id).length === 1);
    for (const item of singles) {
      const options: SpecialRequest[] = [
        { kind: 'top', item },
        { kind: 'offFloor', item },
        { kind: 'middle', item },
      ];
      for (const request of options) {
        const check = checkReceipt({ title, items, request, note });
        if (check.ok) return check;
      }
    }
    return null;
  };

  it('accepts a solvable receipt with a useful request and rates it', () => {
    const result = firstValid('Hosting my in-laws', inLaws, 'Thanks!');
    assert.ok(result && result.ok);
    assert.equal(result.note, 'Thanks!');
    assert.ok(isSpecialRequest(result.request));
  });

  it('asks for a request once the bag is packable', () => {
    const result = checkReceipt({ title: 'Hosting my in-laws', items: inLaws, request: null });
    assert.deepEqual(result, { ok: false, reason: MISSING_REQUEST });
  });

  it('rejects a request on an item listed twice', () => {
    const result = checkReceipt({
      title: 'Hosting my in-laws',
      items: inLaws,
      request: { kind: 'top', item: 'wine' },
    });
    assert.equal(result.ok, false);
  });

  it('rejects impossible receipts', () => {
    const result = checkReceipt({
      title: 'Too many melons',
      items: ['watermelon', 'watermelon', 'watermelon', 'eggs', 'eggs', 'eggs', 'chips', 'chips'],
      request: { kind: 'top', item: 'chips' },
    });
    assert.equal(result.ok, false);
  });

  it('rejects bad titles and notes', () => {
    const request: SpecialRequest = { kind: 'top', item: 'apples' };
    assert.equal(checkReceipt({ title: 'x', items: ['apples'], request }).ok, false);
    assert.equal(checkReceipt({ title: 'visit https://spam.example', items: ['apples'], request }).ok, false);
    assert.equal(firstValid('Hosting my in-laws', inLaws, 'see https://spam.example'), null);
    assert.equal(firstValid('Hosting my in-laws', inLaws, 'x'.repeat(61)), null);
  });
});

describe('dates', () => {
  it('numbers days from launch and formats them', () => {
    assert.equal(dayNumber('2026-11-20'), 1);
    assert.equal(dayNumber('2026-12-09'), 20);
    assert.equal(formatDay('2026-12-09'), 'Wed, Dec 9');
  });
});
