import type { Hop } from '../../../domain/index.ts';

export const HOP: Hop = { from: 6, to: 7 };
export const DOCS = 'https://mongoosejs.com/docs/migrating_to_7.html';

/**
 * Methods that took a callback in 6 and do not in 7. Used by the callback rule
 * to keep `(err, result) => {}` on someone else's API out of the report.
 */
export const CALLBACK_METHODS = [
  'find', 'findOne', 'findById', 'findOneAndUpdate', 'findByIdAndUpdate',
  'findOneAndDelete', 'findByIdAndDelete', 'findOneAndRemove', 'findByIdAndRemove',
  'findOneAndReplace', 'countDocuments', 'estimatedDocumentCount', 'count',
  'distinct', 'exists', 'save', 'create', 'insertMany', 'updateOne', 'updateMany',
  'update', 'replaceOne', 'deleteOne', 'deleteMany', 'remove', 'aggregate',
  'populate', 'validate', 'exec', 'bulkWrite', 'watch', 'startSession',
] as const;
