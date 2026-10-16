import { Node } from 'ts-morph';
import { defineAutoFix } from '../../../application/rule.ts';
import { connectionOptions, usesMongoose } from '../ast.ts';
import { DOCS, HOP } from './hop.ts';

export const poolSizeRenamed = defineAutoFix({
  id: 'pool-size-renamed',
  hop: HOP,
  title: 'poolSize → maxPoolSize',
  docs: DOCS,
  explain: `
    Driver 4 renamed the option. Same number, same meaning; there is also a
    matching minPoolSize now, which defaults to 0.
  `,

  detect: (file) =>
    usesMongoose(file)
      ? connectionOptions(file, ['poolSize']).map((property) => ({ node: property }))
      : [],

  transform: ({ node }) => {
    if (node.wasForgotten()) return false;
    const name = node.getNameNode();
    // Preserve the author's key style: 'poolSize' stays quoted, poolSize does not.
    name.replaceWithText(Node.isStringLiteral(name) ? `'maxPoolSize'` : 'maxPoolSize');
    return true;
  },
});
