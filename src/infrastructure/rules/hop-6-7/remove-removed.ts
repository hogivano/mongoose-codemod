import { defineManual } from '../../../application/rule.ts';
import { mayCallMongoose, methodCalls, receiverText, usesMongoose } from '../ast.ts';
import { DOCS, HOP } from './hop.ts';

/**
 * MECHANICAL but not auto, and the reason is the interesting part.
 *
 * `Model.remove()` meant deleteMany(); `doc.remove()` meant deleteOne(). The
 * correct replacement therefore depends on whether the receiver is a model or a
 * document — a type question, and this pass runs without type information.
 * Guessing here would silently change how many documents get deleted, so the
 * rule reports the site and names both options instead.
 */
export const removeRemoved = defineManual({
  id: 'remove-removed',
  hop: HOP,
  title: 'remove() → deleteOne() / deleteMany()',
  docs: DOCS,
  explain: `
    remove() is gone in 7, and the replacement depends on the receiver:

      Model.remove(filter)   →  Model.deleteMany(filter)   (it deleted all matches)
      doc.remove()           →  doc.deleteOne()

    Getting this backwards deletes a collection instead of a document, which is
    why it is not rewritten automatically.
  `,

  detect: (file) =>
    usesMongoose(file)
      ? methodCalls(file, ['remove'])
          .filter(mayCallMongoose)
          .map((call) => ({
          node: call,
          note: `${receiverText(call) ?? 'receiver'} — a model means deleteMany(), a document means deleteOne()`,
        }))
      : [],
});
