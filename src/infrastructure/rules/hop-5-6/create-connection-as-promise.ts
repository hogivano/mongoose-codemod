import { Node } from 'ts-morph';
import { defineAutoFix } from '../../../application/rule.ts';
import { calleeName, insertAfter, usesMongoose } from '../ast.ts';
import { DOCS, HOP } from './hop.ts';
import { SyntaxKind } from 'ts-morph';

/**
 * `await createConnection(uri)` → `await createConnection(uri).asPromise()`.
 *
 * In Mongoose 6 createConnection() returns a Connection, not a thenable. The
 * await still compiles and still resolves — to the un-connected Connection —
 * so this one fails later, in a query, rather than here. Worth fixing exactly.
 */
export const createConnectionAsPromise = defineAutoFix({
  id: 'create-connection-as-promise',
  hop: HOP,
  title: 'await createConnection(…) needs .asPromise()',
  docs: DOCS,
  explain: `
    createConnection() no longer returns a promise. Awaiting it resolves
    immediately with a connection that is not ready yet:
      await mongoose.createConnection(uri).asPromise()
  `,

  detect: (file) => {
    if (!usesMongoose(file)) return [];
    return file
      .getDescendantsOfKind(SyntaxKind.AwaitExpression)
      .filter((await_) => {
        const inner = await_.getExpression();
        return Node.isCallExpression(inner) && calleeName(inner) === 'createConnection';
      })
      .map((await_) => ({ node: await_ }));
  },

  transform: ({ node }) => {
    if (node.wasForgotten()) return false;
    const inner = node.getExpression();
    if (!Node.isCallExpression(inner)) return false;
    // Appended by position: the call's options object is usually multi-line,
    // and replacing the node would re-indent all of it.
    return insertAfter(inner, '.asPromise()');
  },
});
