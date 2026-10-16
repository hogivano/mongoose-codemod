import { Node } from 'ts-morph';
import { defineSemantic } from '../../../application/rule.ts';
import { mayCallMongoose, methodCalls, propertiesNamed, usesMongoose } from '../ast.ts';
import { DOCS, HOP } from './hop.ts';

/** Update methods whose payload argument we look inside. */
const UPDATE_CALLS = [
  'update',
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'findByIdAndUpdate',
];

/**
 * Under `timestamps: true`, Mongoose 6 makes `createdAt` immutable. Writes to
 * it are dropped rather than rejected, so backfills and imports quietly stop
 * doing anything.
 */
export const timestampsCreatedAtImmutable = defineSemantic({
  id: 'timestamps-created-at-immutable',
  hop: HOP,
  title: 'createdAt is immutable under timestamps: true',
  docs: DOCS,
  explain: `
    The write is ignored, not rejected — the update reports success and the
    value does not change. Data imports and backfills are where this shows up.

    If a schema really needs to set it, declare the field with immutable: false.
  `,

  detect: (file) => {
    if (!usesMongoose(file)) return [];
    return methodCalls(file, UPDATE_CALLS)
      .filter(mayCallMongoose)
      .flatMap((call) => call.getArguments())
      .filter(Node.isObjectLiteralExpression)
      .flatMap((payload) => propertiesNamed(payload, ['createdAt']))
      .map((property) => ({ node: property }));
  },
});
