import { defineManual } from '../../../application/rule.ts';
import { usesMongoose } from '../ast.ts';
import { DOCS, HOP } from './hop.ts';
import { SyntaxKind } from 'ts-morph';

/**
 * Only `nModified` is listed. `n` and `ok` changed too, but those names are far
 * too common on non-Mongoose objects to match on without types — reporting them
 * would bury the real findings.
 *
 * A Map, not an object literal: `RENAMED['toString']` on a plain object finds
 * `Object.prototype.toString` and is not undefined, which made this rule match
 * every `.toString()` in the codebase.
 */
const RENAMED = new Map([['nModified', 'modifiedCount']]);

/**
 * MECHANICAL but not auto: `result.nModified` is unambiguous, but the same
 * property name on a non-Mongoose object would be silently renamed too, and we
 * have no types to tell them apart. Reported, with the replacement named.
 */
export const writeResultFields = defineManual({
  id: 'write-result-fields',
  hop: HOP,
  title: 'write result fields renamed',
  docs: DOCS,
  explain: `
    Update and delete results come from driver 4 now:
      n → matchedCount     nModified → modifiedCount     ok → acknowledged
    deleteOne() results no longer carry n at all; use deletedCount.
  `,

  detect: (file) => {
    if (!usesMongoose(file)) return [];
    return file
      .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
      .flatMap((access) => {
        const replacement = RENAMED.get(access.getName());
        return replacement === undefined
          ? []
          : [{ node: access, note: `use ${replacement} if this is a write result` }];
      });
  },
});
