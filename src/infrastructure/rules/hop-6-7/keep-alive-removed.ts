import { defineAutoFix } from '../../../application/rule.ts';
import { connectionOptions, propertyName, removeProperty, usesMongoose } from '../ast.ts';
import { DOCS, HOP } from './hop.ts';

const REMOVED = ['keepAlive', 'keepAliveInitialDelay'];

export const keepAliveRemoved = defineAutoFix({
  id: 'keep-alive-removed',
  hop: HOP,
  title: 'removed keepAlive options',
  docs: DOCS,
  explain: `
    keepAlive is always on in the driver now, so the options were removed.
    Deleting the key is the whole change.
  `,

  detect: (file) =>
    usesMongoose(file)
      ? connectionOptions(file, REMOVED).map((property) => ({
          node: property,
          note: `${propertyName(property)} is always on now`,
        }))
      : [],

  transform: ({ node }) => removeProperty(node),
});
