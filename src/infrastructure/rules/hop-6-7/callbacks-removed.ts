import { Node } from 'ts-morph';
import type { CallExpression } from 'ts-morph';
import { defineManual } from '../../../application/rule.ts';
import { calleeName, mayCallMongoose, methodCalls, usesMongoose } from '../ast.ts';
import { CALLBACK_METHODS, DOCS, HOP } from './hop.ts';

/**
 * The biggest change in the hop: 40+ methods stopped accepting a callback.
 *
 * Reported, not rewritten — for now. Turning `Model.find(q, (err, docs) => {})`
 * into `await` means deciding where the error goes, which is a change to the
 * caller's control flow and not a local rewrite. A later step makes this
 * a `defineAutoFix`; until the transform is provably correct, promising
 * a fix we cannot deliver is worse than reporting honestly.
 *
 * The match is narrow on purpose: a known Mongoose method, a function as the
 * last argument, and an error-shaped first parameter.
 */
export const callbacksRemoved = defineManual({
  id: 'callbacks-removed',
  hop: HOP,
  title: 'callbacks removed from query and model methods',
  docs: DOCS,
  explain: `
    Mongoose 7 throws MongooseError: Model.find() no longer accepts a callback.

    Model.find(query, (err, docs) => { ... })
      →  const docs = await Model.find(query)   with the error handled by the caller

    Where the error was handled inside the callback, that handling has to move
    to a try/catch — which is why this is not rewritten for you.
  `,

  detect: (file) => {
    if (!usesMongoose(file)) return [];
    return methodCalls(file, [...CALLBACK_METHODS])
      .filter(mayCallMongoose)
      .filter(hasErrorFirstCallback)
      .map((call) => ({ node: call, note: `${calleeName(call)}() takes no callback in 7` }));
  },
});

/**
 * Last argument is a function whose first parameter is named err or error.
 *
 * `e` was on this list and had to come off: it matched every
 * `_.find(list, (e) => ...)` in the codebase, where `e` is an element. A
 * one-letter parameter is not evidence of an error-first callback.
 */
function hasErrorFirstCallback(call: CallExpression): boolean {
  const args = call.getArguments();
  const last = args[args.length - 1];
  if (last === undefined) return false;
  if (!Node.isArrowFunction(last) && !Node.isFunctionExpression(last)) return false;

  const first = last.getParameters()[0];
  if (first === undefined) return false;
  return ['err', 'error'].includes(first.getName());
}
