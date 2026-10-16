import { Node } from 'ts-morph';
import { defineAutoFix } from '../../../application/rule.ts';
import { callsMongoose, methodCalls, usesMongoose } from '../ast.ts';
import { DOCS, HOP } from './hop.ts';

/**
 * `.count()` → `.countDocuments()`. Deprecated since 5, removed in 7.
 *
 * Same result for the same filter; countDocuments() is the accurate one, and
 * the one that has been the recommendation since the 5.x deprecation warning.
 */
export const countToCountDocuments = defineAutoFix({
  id: 'count-to-count-documents',
  hop: HOP,
  title: 'count() → countDocuments()',
  docs: DOCS,
  explain: `
    count() is removed in 7. countDocuments() takes the same filter and returns
    the same number.

    For a whole-collection count with no filter, estimatedDocumentCount() is
    much faster — worth considering while you are here, but not something this
    tool decides for you.

    Only calls that resolve into the mongoose package are rewritten; your own
    count() and lodash's are left alone.
  `,

  detect: (file) =>
    usesMongoose(file)
      ? methodCalls(file, ['count']).filter(callsMongoose).map((call) => ({ node: call }))
      : [],

  transform: ({ node }) => {
    if (node.wasForgotten()) return false;
    const callee = node.getExpression();
    if (!Node.isPropertyAccessExpression(callee)) return false;
    callee.getNameNode().replaceWithText('countDocuments');
    return true;
  },
});
