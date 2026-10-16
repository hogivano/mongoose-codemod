import { Node } from 'ts-morph';
import { defineAutoFix } from '../../../application/rule.ts';
import { calleeName, methodCalls, replaceRange, usesMongoose } from '../ast.ts';
import { DOCS, HOP } from './hop.ts';

/**
 * `doc.populate(path).execPopulate()` → `doc.populate(path)`.
 *
 * Only the chained form is rewritten. A bare `doc.execPopulate()` — where the
 * populate() calls happened somewhere earlier — needs those paths gathered into
 * one call, which is a judgement about the surrounding code, not a rewrite. The
 * transform declines those and they come back as remaining work.
 */
export const execPopulateRemoved = defineAutoFix({
  id: 'exec-populate-removed',
  hop: HOP,
  title: 'execPopulate() removed',
  docs: DOCS,
  explain: `
    populate() on a document now returns a promise directly:
      await doc.populate('author').execPopulate()   →   await doc.populate('author')
    Several paths become one call: await doc.populate(['author', 'comments']).
  `,

  detect: (file) =>
    usesMongoose(file)
      ? methodCalls(file, ['execPopulate']).map((call) => {
          const chained = isChainedOnPopulate(call);
          return {
            node: call,
            ...(chained ? {} : { note: 'not chained onto populate() — needs a hand rewrite' }),
          };
        })
      : [],

  transform: ({ node }) => {
    if (node.wasForgotten() || !isChainedOnPopulate(node)) return false;
    const callee = node.getExpression();
    if (!Node.isPropertyAccessExpression(callee)) return false;
    // Drop the `.execPopulate()` tail, keeping the populate() chain exactly as
    // written — the chain can span lines, so this edits by position.
    return replaceRange(node, callee.getExpression().getText());
  },
});

function isChainedOnPopulate(call: import('ts-morph').CallExpression): boolean {
  const callee = call.getExpression();
  if (!Node.isPropertyAccessExpression(callee)) return false;
  const receiver = callee.getExpression();
  return Node.isCallExpression(receiver) && calleeName(receiver) === 'populate';
}
