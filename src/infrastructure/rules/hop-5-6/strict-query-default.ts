import { defineSemantic } from '../../../application/rule.ts';
import { methodCalls, usesMongoose } from '../ast.ts';
import { DOCS, HOP } from './hop.ts';

/**
 * A default flipped, so there is no call site to point at. The connect() call
 * is used as the anchor because it is where the fix goes — one finding per
 * connection setup, in the file you would edit.
 *
 * See also strict-query-default-back in hop 6→7: this same default flips again
 * in the next major, which is exactly why hops are modelled separately.
 */
export const strictQueryDefault = defineSemantic({
  id: 'strict-query-default',
  hop: HOP,
  title: 'strictQuery now defaults to true',
  docs: DOCS,
  explain: `
    Query filters on paths that are not in the schema are silently dropped in 6.
    A find({ emailAddress: x }) against a schema with email stops filtering and
    starts returning everything.

    Pin the behaviour rather than inheriting it, in both directions — 7 flips
    this default back to false:
      mongoose.set('strictQuery', false)
  `,

  detect: (file) =>
    usesMongoose(file)
      ? methodCalls(file, ['connect']).map((call) => ({
          node: call,
          note: 'set strictQuery explicitly here',
        }))
      : [],
});
