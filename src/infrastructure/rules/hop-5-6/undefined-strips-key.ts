import { Node, SyntaxKind } from 'ts-morph';
import { defineSemantic } from '../../../application/rule.ts';
import { allPropertiesNamed, usesMongoose } from '../ast.ts';
import { DOCS, HOP } from './hop.ts';

/**
 * `{ $set: { name: undefined } }` unset the key in 5 and strips it from the
 * update in 6 — the field keeps its old value instead of being cleared.
 *
 * Only a literal `undefined` is detectable here. The far more common case is a
 * variable that happens to be undefined at runtime, which no static rule can
 * see; the explanation says so rather than implying the report is exhaustive.
 */
export const undefinedStripsKey = defineSemantic({
  id: 'undefined-strips-key',
  hop: HOP,
  title: 'undefined in an update strips the key instead of unsetting it',
  docs: DOCS,
  explain: `
    5: { $set: { name: undefined } } cleared name.
    6: the key is removed from the update, so name keeps its previous value.

    Use $unset to clear a field. Note this rule can only see a literal
    undefined — a variable that is undefined at runtime behaves the same way
    and will not appear in this report.
  `,

  detect: (file) => {
    if (!usesMongoose(file)) return [];
    return allPropertiesNamed(file, ['$set', '$setOnInsert'])
      .flatMap((operator) => {
        const payload = operator.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
        return payload === undefined ? [] : payload.getProperties();
      })
      .filter(
        (property) =>
          Node.isPropertyAssignment(property) &&
          property.getInitializer()?.getText() === 'undefined',
      )
      .map((property) => ({ node: property }));
  },
});
