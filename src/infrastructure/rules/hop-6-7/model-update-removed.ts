import { Node, SyntaxKind } from 'ts-morph';
import type { CallExpression } from 'ts-morph';
import { defineAutoFix } from '../../../application/rule.ts';
import { callsMongoose, methodCalls, propertiesNamed, usesMongoose } from '../ast.ts';
import { DOCS, HOP } from './hop.ts';

/**
 * `.update()` → `.updateOne()`.
 *
 * Safe because update() only ever touched the first match unless `multi: true`
 * was passed — so the mapping is total, with one carve-out. Sites that do pass
 * `multi: true` mean updateMany(), and dropping that option while renaming the
 * method would change how many documents get written. Those are declined.
 */
export const modelUpdateRemoved = defineAutoFix({
  id: 'model-update-removed',
  hop: HOP,
  title: 'update() → updateOne()',
  docs: DOCS,
  explain: `
    update() is gone in 7. It updated a single document by default, so
    updateOne() is the exact equivalent.

    Sites passing { multi: true } are left alone: those mean updateMany(), and
    the option has to go at the same time. Change them by hand.

    Only calls that resolve into the mongoose package are rewritten, so a
    data-access layer with its own update() method is left alone.
  `,

  detect: (file) => {
    if (!usesMongoose(file)) return [];
    return methodCalls(file, ['update'])
      .filter(callsMongoose)
      .map((call) => ({
        node: call,
        ...(isMulti(call) ? { note: 'passes multi: true — this one means updateMany()' } : {}),
      }));
  },

  transform: ({ node }) => {
    if (node.wasForgotten() || isMulti(node)) return false;
    const callee = node.getExpression();
    if (!Node.isPropertyAccessExpression(callee)) return false;
    callee.getNameNode().replaceWithText('updateOne');
    return true;
  },
});

function isMulti(call: CallExpression): boolean {
  return call
    .getArguments()
    .filter(Node.isObjectLiteralExpression)
    .flatMap((options) => propertiesNamed(options, ['multi']))
    .some((property) => property.getInitializer()?.getKind() === SyntaxKind.TrueKeyword);
}
