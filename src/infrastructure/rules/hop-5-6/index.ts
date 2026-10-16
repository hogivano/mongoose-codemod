/**
 * Mongoose 5 → 6, in report order: mechanical first, then the semantic ones the
 * tool will not touch.
 *
 * Still to add, each needing dataflow this pass does not have:
 *   - a query object cannot be executed twice; needs Query#clone()
 *   - populating a path with no ref/refPath is a no-op, not a fallback
 *   - typePojoToMixed removed: { type: { name: String } } is now a subdocument
 */

import type { Rule } from '../../../application/rule.ts';
import { connectOptionsRemoved } from './connect-options-removed.ts';
import { createConnectionAsPromise } from './create-connection-as-promise.ts';
import { defaultFunctionReceivesDoc } from './default-function-receives-doc.ts';
import { execPopulateRemoved } from './exec-populate-removed.ts';
import { existsReturnsDocument } from './exists-returns-document.ts';
import { nestedSetOverwrites } from './nested-set-overwrites.ts';
import { poolSizeRenamed } from './pool-size-renamed.ts';
import { reconnectOptionsRemoved } from './reconnect-options-removed.ts';
import { safeToWriteConcern } from './safe-to-write-concern.ts';
import { setRemovedOptions } from './set-removed-options.ts';
import { strictQueryDefault } from './strict-query-default.ts';
import { timestampsCreatedAtImmutable } from './timestamps-created-at-immutable.ts';
import { undefinedStripsKey } from './undefined-strips-key.ts';
import { writeResultFields } from './write-result-fields.ts';

export const HOP_5_6_RULES: readonly Rule[] = [
  connectOptionsRemoved,
  setRemovedOptions,
  poolSizeRenamed,
  reconnectOptionsRemoved,
  execPopulateRemoved,
  createConnectionAsPromise,
  safeToWriteConcern,
  writeResultFields,
  nestedSetOverwrites,
  existsReturnsDocument,
  defaultFunctionReceivesDoc,
  strictQueryDefault,
  undefinedStripsKey,
  timestampsCreatedAtImmutable,
];
