import { Node, SyntaxKind } from 'ts-morph';
import { defineSemantic } from '../../../application/rule.ts';
import { mayCallMongoose, methodCalls, usesMongoose } from '../ast.ts';
import { DOCS, HOP } from './hop.ts';

/**
 * The worst one in the hop, and the reason `apply` exists as a separate verb.
 *
 * In Mongoose 5, doc.set({ child: { age: 21 } }) merged into `child`. In 6 it
 * replaces `child` wholesale, so every other field under it becomes undefined
 * and is written away on save. Nothing throws. Nothing logs.
 *
 * Only nested object literals are reported — a flat set() is unaffected, and
 * reporting those would drown the ones that matter.
 */
export const nestedSetOverwrites = defineSemantic({
  id: 'nested-set-overwrites',
  hop: HOP,
  title: 'doc.set() with nested paths overwrites instead of merging',
  docs: DOCS,
  explain: `
    SILENT DATA LOSS if any of these relied on the merge.

    Mongoose 5:  doc.set({ child: { age: 21 } })  kept child.name
    Mongoose 6:  the same call replaces child entirely — child.name is gone,
                 and save() writes that away.

    Check each site. If it meant to merge, set the leaf path instead:
      doc.set('child.age', 21)
  `,

  detect: (file) => {
    if (!usesMongoose(file)) return [];
    return methodCalls(file, ['set']).filter(mayCallMongoose).flatMap((call) => {
      const [first] = call.getArguments();
      if (!Node.isObjectLiteralExpression(first)) return [];
      const nested = first
        .getProperties()
        .filter(
          (property) =>
            Node.isPropertyAssignment(property) &&
            property.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression) !== undefined,
        );
      return nested.length === 0
        ? []
        : [{ node: call, note: `nested path${nested.length > 1 ? 's' : ''} in this set()` }];
    });
  },
});
