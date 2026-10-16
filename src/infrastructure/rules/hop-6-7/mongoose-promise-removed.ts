import { Node, SyntaxKind } from 'ts-morph';
import { defineAutoFix } from '../../../application/rule.ts';
import { enclosingStatement, usesMongoose } from '../ast.ts';
import { DOCS, HOP } from './hop.ts';

/**
 * `mongoose.Promise = global.Promise` — a 4.x-era workaround for mpromise.
 * Mongoose has used native promises for years; in 7 the property is gone.
 */
export const mongoosePromiseRemoved = defineAutoFix({
  id: 'mongoose-promise-removed',
  hop: HOP,
  title: 'mongoose.Promise assignment removed',
  docs: DOCS,
  explain: `
    Mongoose uses native promises and no longer exposes this property. The line
    does nothing in 6 and is an error in 7 — delete it.
  `,

  detect: (file) => {
    if (!usesMongoose(file)) return [];
    return file
      .getDescendantsOfKind(SyntaxKind.BinaryExpression)
      .filter(
        (expression) =>
          expression.getOperatorToken().getKind() === SyntaxKind.EqualsToken &&
          expression.getLeft().getText().endsWith('.Promise'),
      )
      .flatMap((expression) => {
        const statement = enclosingStatement(expression);
        return statement && Node.isExpressionStatement(statement) ? [{ node: statement }] : [];
      });
  },

  transform: ({ node }) => {
    if (node.wasForgotten()) return false;
    node.remove();
    return true;
  },
});
