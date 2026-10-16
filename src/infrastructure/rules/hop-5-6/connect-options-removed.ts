import { defineAutoFix } from '../../../application/rule.ts';
import { connectionOptions, propertyName, removeProperty, usesMongoose } from '../ast.ts';
import { DOCS, HOP } from './hop.ts';

/**
 * Mongoose 6 moved to MongoDB driver 4, where these four are the only
 * behaviour there is. Passing them now throws instead of being ignored — which
 * is why this is usually the first thing that breaks after the bump.
 */
const REMOVED = ['useNewUrlParser', 'useUnifiedTopology', 'useFindAndModify', 'useCreateIndex'];

export const connectOptionsRemoved = defineAutoFix({
  id: 'connect-options-removed',
  hop: HOP,
  title: 'removed connect() options',
  docs: DOCS,
  explain: `
    Mongoose 6 always behaves the way these options asked for, and rejects them
    as unrecognised. Deleting the key is the entire change; no behaviour moves.
  `,

  detect: (file) =>
    usesMongoose(file)
      ? connectionOptions(file, REMOVED).map((property) => ({
          node: property,
          note: `${propertyName(property)} is now the only behaviour`,
        }))
      : [],

  transform: ({ node }) => removeProperty(node),
});
