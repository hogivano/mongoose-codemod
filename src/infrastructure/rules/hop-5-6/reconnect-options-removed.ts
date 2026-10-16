import { defineAutoFix } from '../../../application/rule.ts';
import { connectionOptions, propertyName, removeProperty, usesMongoose } from '../ast.ts';
import { DOCS, HOP } from './hop.ts';

const REMOVED = ['reconnectTries', 'reconnectInterval', 'autoReconnect'];

export const reconnectOptionsRemoved = defineAutoFix({
  id: 'reconnect-options-removed',
  hop: HOP,
  title: 'removed reconnect options',
  docs: DOCS,
  explain: `
    Driver 4 reconnects on its own and no longer takes these. Reconnection did
    not go away — the knobs did.
  `,

  detect: (file) =>
    usesMongoose(file)
      ? connectionOptions(file, REMOVED).map((property) => ({
          node: property,
          note: `${propertyName(property)} is handled by the driver now`,
        }))
      : [],

  transform: ({ node }) => removeProperty(node),
});
