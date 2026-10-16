import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatHop, hopId, hopsBetween, isSingleHop } from '../../src/domain/index.ts';

describe('hops', () => {
  it('expands an upgrade into consecutive single hops', () => {
    assert.deepEqual(hopsBetween(5, 8), [
      { from: 5, to: 6 },
      { from: 6, to: 7 },
      { from: 7, to: 8 },
    ]);
  });

  it('refuses anything that is not an upgrade', () => {
    assert.throws(() => hopsBetween(7, 7), RangeError);
    assert.throws(() => hopsBetween(7, 5), RangeError);
  });

  it('formats for machines and for people', () => {
    assert.equal(hopId({ from: 5, to: 6 }), '5->6');
    assert.equal(formatHop({ from: 5, to: 6 }), '5 → 6');
  });

  it('knows a single hop from a run of them', () => {
    assert.equal(isSingleHop(5, 6), true);
    assert.equal(isSingleHop(5, 7), false);
  });
});
