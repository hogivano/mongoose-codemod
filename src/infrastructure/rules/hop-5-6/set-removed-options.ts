import { Node } from 'ts-morph';
import { defineAutoFix } from '../../../application/rule.ts';
import { enclosingStatement, methodCalls, usesMongoose } from '../ast.ts';
import { DOCS, HOP } from './hop.ts';

/** The same four options, in their `mongoose.set('useCreateIndex', true)` form. */
const REMOVED = ['useNewUrlParser', 'useUnifiedTopology', 'useFindAndModify', 'useCreateIndex'];

export const setRemovedOptions = defineAutoFix({
  id: 'set-removed-options',
  hop: HOP,
  title: "mongoose.set('useCreateIndex', …) and friends",
  docs: DOCS,
  explain: `
    Global form of the removed connection options. Mongoose 6 throws on an
    unrecognised option name, so the whole call goes.
  `,

  detect: (file) => {
    if (!usesMongoose(file)) return [];
    return methodCalls(file, ['set']).flatMap((call) => {
      const [name] = call.getArguments();
      if (!Node.isStringLiteral(name) || !REMOVED.includes(name.getLiteralValue())) return [];
      const statement = enclosingStatement(call);
      // Only a standalone statement can be deleted outright. `const x = ...set()`
      // is not a shape we understand, so we leave it for a human.
      return statement && Node.isExpressionStatement(statement)
        ? [{ node: statement, note: `${name.getLiteralValue()} no longer exists` }]
        : [];
    });
  },

  transform: ({ node }) => {
    if (node.wasForgotten()) return false;
    node.remove();
    return true;
  },
});
