import { defineSemantic } from '../../../application/rule.ts';
import { methodCalls, usesMongoose } from '../ast.ts';
import { DOCS, HOP } from './hop.ts';

/**
 * The proof that hops cannot be collapsed: 6 made strictQuery true,
 * 7 makes it false again. A tool that models 5 → 9 as one transformation gets
 * this exactly backwards for anyone stopping at 6.
 */
export const strictQueryDefaultBack = defineSemantic({
  id: 'strict-query-default-back',
  hop: HOP,
  title: 'strictQuery defaults back to false',
  docs: DOCS,
  explain: `
    The opposite of the 6 default. Filter properties that are not in the schema
    are honoured again instead of being dropped.

    If you adjusted queries to work around the 6 behaviour, or added
    mongoose.set('strictQuery', true) during that upgrade, revisit it here.
  `,

  detect: (file) =>
    usesMongoose(file)
      ? methodCalls(file, ['connect']).map((call) => ({
          node: call,
          note: 'the default flips back at this hop',
        }))
      : [],
});
