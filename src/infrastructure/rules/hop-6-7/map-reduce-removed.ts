import { defineSemantic } from '../../../application/rule.ts';
import { methodCalls, usesMongoose } from '../ast.ts';
import { DOCS, HOP } from './hop.ts';

/**
 * `mapReduce()` is gone, and the replacement is an aggregation pipeline — a
 * different program, not a different call. Classified SEMANTIC rather than
 * mechanical-manual because the rewrite has to preserve what the JavaScript
 * reduce function actually computed, and getting that subtly wrong produces
 * plausible numbers that are not the same numbers.
 */
export const mapReduceRemoved = defineSemantic({
  id: 'map-reduce-removed',
  hop: HOP,
  title: 'mapReduce() removed',
  docs: DOCS,
  explain: `
    Rewrite as an aggregation: $group with $sum, $push or $accumulator.

    Verify the result against the old output on real data before shipping. A
    mapReduce that emitted more than one value per key, or relied on the reduce
    function running repeatedly, does not translate line for line.
  `,

  detect: (file) =>
    usesMongoose(file) ? methodCalls(file, ['mapReduce']).map((call) => ({ node: call })) : [],
});
