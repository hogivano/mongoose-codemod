import { Node } from 'ts-morph';
import { defineSemantic } from '../../../application/rule.ts';
import { acceptsAnArgument, allPropertiesNamed, usesMongoose } from '../ast.ts';
import { DOCS, HOP } from './hop.ts';

/**
 * Mongoose 6 passes the document to default functions as the first argument.
 * `default: mongoose.Types.ObjectId` therefore stops meaning "a fresh id" and
 * starts meaning "an ObjectId built from this document".
 *
 * Only bare function *references* are reported. `default: () => ...` already
 * ignores the argument, and a literal default is not a function at all.
 *
 * The hard part is that `default: ObjectId` and `default: FieldType.STRING` are
 * the same shape to the parser, and only one of them is callable. The type
 * checker settles it — see `acceptsAnArgument`.
 */

export const defaultFunctionReceivesDoc = defineSemantic({
  id: 'default-function-receives-doc',
  hop: HOP,
  title: 'default functions now receive the document as the first argument',
  docs: DOCS,
  explain: `
    default: mongoose.Types.ObjectId
      6 calls it as ObjectId(doc) — an id derived from your document, not a new one.

    Wrap anything that must ignore the argument:
      default: () => new mongoose.Types.ObjectId()

    Only functions that declare a parameter are reported. A default taking no
    arguments, such as Date.now, cannot see the document and is unaffected, and
    enum members like default: Status.Active are not functions at all. A
    reference whose type cannot be resolved is skipped rather than guessed at.
  `,

  detect: (file) => {
    if (!usesMongoose(file)) return [];
    return allPropertiesNamed(file, ['default'])
      .filter((property) => {
        const initializer = property.getInitializer();
        // A bare reference: `ObjectId`, `Types.ObjectId`, `uuid.v4`. Calls,
        // arrows and literals already control their own arguments.
        if (
          initializer === undefined ||
          (!Node.isIdentifier(initializer) && !Node.isPropertyAccessExpression(initializer))
        ) {
          return false;
        }
        return acceptsAnArgument(initializer);
      })
      .map((property) => ({
        node: property,
        note: `${property.getInitializer()?.getText()} will be called with the document`,
      }));
  },
});
