/**
 * Mongoose 6 → 7.
 *
 * Still to add:
 *   - the callback → await transform itself (callbacksRemoved becomes auto)
 *   - castForQuery() on custom types: (conditional, value, context)
 *   - _bsontype 'ObjectID' → 'ObjectId'
 *   - TS: drop LeanDocument and `extends Document`; HydratedDocument generics
 *     reordered to (DocType, TOverrides, TQueryHelpers)
 */

import type { Rule } from '../../../application/rule.ts';
import { callbacksRemoved } from './callbacks-removed.ts';
import { countToCountDocuments } from './count-to-count-documents.ts';
import { keepAliveRemoved } from './keep-alive-removed.ts';
import { mapReduceRemoved } from './map-reduce-removed.ts';
import { modelUpdateRemoved } from './model-update-removed.ts';
import { mongoosePromiseRemoved } from './mongoose-promise-removed.ts';
import { objectIdNeedsNew } from './objectid-needs-new.ts';
import { removeRemoved } from './remove-removed.ts';
import { strictQueryDefaultBack } from './strict-query-default-back.ts';

export const HOP_6_7_RULES: readonly Rule[] = [
  modelUpdateRemoved,
  countToCountDocuments,
  objectIdNeedsNew,
  mongoosePromiseRemoved,
  keepAliveRemoved,
  callbacksRemoved,
  removeRemoved,
  strictQueryDefaultBack,
  mapReduceRemoved,
];
