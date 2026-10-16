import { Node, SyntaxKind } from 'ts-morph';
import { defineAutoFix } from '../../../application/rule.ts';
import { insertBefore, usesMongoose } from '../ast.ts';
import { DOCS, HOP } from './hop.ts';

/**
 * `ObjectId(id)` → `new ObjectId(id)`. In 7 ObjectId is a real class, so
 * calling it without `new` throws a TypeError.
 */
export const objectIdNeedsNew = defineAutoFix({
  id: 'objectid-needs-new',
  hop: HOP,
  title: 'ObjectId is a class — add new',
  docs: DOCS,
  explain: `
    Class constructors cannot be called without new:
      mongoose.Types.ObjectId(id)   →   new mongoose.Types.ObjectId(id)
  `,

  detect: (file) => {
    if (!usesMongoose(file)) return [];
    return file
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((call) => {
        const text = call.getExpression().getText();
        // `ObjectId` or anything ending `.ObjectId` — Types.ObjectId,
        // mongoose.Types.ObjectId, Schema.Types.ObjectId.
        if (text !== 'ObjectId' && !text.endsWith('.ObjectId')) return false;
        // Already a `new` expression: the call is the constructor invocation.
        return !Node.isNewExpression(call.getParent());
      })
      .map((call) => ({ node: call }));
  },

  // Prepended by position, so a call whose arguments span several lines keeps
  // the formatting it had.
  transform: ({ node }) => insertBefore(node, 'new '),
});
