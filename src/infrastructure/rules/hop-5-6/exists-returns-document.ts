import { defineSemantic } from '../../../application/rule.ts';
import { mayCallMongoose, methodCalls, usesMongoose } from '../ast.ts';
import { DOCS, HOP } from './hop.ts';

/**
 * `Model.exists()` returns `{ _id }` or `null` in 6, not a boolean.
 *
 * `if (await User.exists(...))` keeps working, which is what makes this
 * dangerous: the sites that break are the ones that store, compare or return
 * the value, and they break as a `true` that is now an object.
 */
export const existsReturnsDocument = defineSemantic({
  id: 'exists-returns-document',
  hop: HOP,
  title: 'Model.exists() returns { _id }, not a boolean',
  docs: DOCS,
  explain: `
    if (await User.exists(query))            still correct — truthiness holds
    return await User.exists(query)          now returns an object, not false
    expect(await User.exists(q)).toBe(true)  now fails

    Where the value is used as a value, append != null.
  `,

  detect: (file) =>
    usesMongoose(file)
      ? methodCalls(file, ['exists']).filter(mayCallMongoose).map((call) => ({ node: call }))
      : [],
});
