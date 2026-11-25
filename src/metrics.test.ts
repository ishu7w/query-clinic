import assert from 'node:assert/strict';
import { test } from 'node:test';
import { median } from './metrics.ts';

test('median handles unordered samples and both sample counts', () => {
  assert.equal(median([5, 1, 9]), 5);
  assert.equal(median([3, 1, 6, 2]), 2.5);
});

test('median rejects missing and invalid samples', () => {
  for (const samples of [[], [NaN], [-1], [Infinity]]) {
    assert.throws(() => median(samples), /finite/);
  }
});
