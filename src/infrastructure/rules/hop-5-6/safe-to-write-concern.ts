import { defineManual } from '../../../application/rule.ts';
import { allPropertiesNamed, usesMongoose } from '../ast.ts';
import { DOCS, HOP } from './hop.ts';

/**
 * MECHANICAL but not auto: the key renames, and the *value* shape changes with
 * it. `safe: true` becomes `writeConcern: { w: 1 }`, `safe: false` becomes
 * `{ w: 0 }`, and `safe: { j: true }` moves across unchanged. Guessing which
 * one the author meant is not a rewrite we can prove, so we point instead.
 */
export const safeToWriteConcern = defineManual({
  id: 'safe-to-write-concern',
  hop: HOP,
  title: 'safe option → writeConcern',
  docs: DOCS,
  explain: `
    The safe option is gone. Translate it by hand — the value shape changes
    along with the key:
      safe: true          →  writeConcern: { w: 1 }
      safe: false         →  writeConcern: { w: 0 }
      safe: { j: true }   →  writeConcern: { j: true }
  `,

  detect: (file) =>
    usesMongoose(file)
      ? allPropertiesNamed(file, ['safe']).map((property) => ({ node: property }))
      : [],
});
