/**
 * Where a method is declared decides whether a rule may touch it.
 *
 * This is the check that stopped 494 rewrites of a data-access layer's own
 * `userDb.update()` on a real codebase. The three cases below are the whole
 * contract, so they are asserted directly rather than only through fixtures.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SyntaxKind } from 'ts-morph';
import { callsMongoose, mayCallMongoose, methodOrigin } from '../../src/infrastructure/rules/ast.ts';
import { inMemoryCodebase } from '../support/in-memory-codebase.ts';

const SOURCE = `
import mongoose from 'mongoose';

const User = mongoose.model('User', new mongoose.Schema({ seen: Boolean }));
const userDb = { update: async (_patch: unknown) => null };

export async function go(untyped) {
  await User.update({}, {});
  await userDb.update({});
  await untyped.update({});
}
`;

/** The three `update(...)` calls, in source order. */
function updateCalls() {
  const codebase = inMemoryCodebase({ 'input.ts': SOURCE });
  return codebase
    .sourceFiles()[0]!
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getText().startsWith('User.update') ||
      call.getText().startsWith('userDb.update') ||
      call.getText().startsWith('untyped.update'));
}

describe('method origin', () => {
  it('tells a Mongoose method from a look-alike and from an unknown', () => {
    const [mongooseCall, ownCall, untypedCall] = updateCalls();

    assert.equal(methodOrigin(mongooseCall!), 'mongoose');
    assert.equal(methodOrigin(ownCall!), 'other', 'the codebase’s own update()');
    assert.equal(methodOrigin(untypedCall!), 'unknown', 'receiver has no type');
  });

  it('lets rewriting rules touch only what is proven to be Mongoose', () => {
    const [mongooseCall, ownCall, untypedCall] = updateCalls();

    assert.equal(callsMongoose(mongooseCall!), true);
    assert.equal(callsMongoose(ownCall!), false);
    // The bar for rewriting is proof, so an unresolved receiver is not enough.
    assert.equal(callsMongoose(untypedCall!), false);
  });

  it('lets reporting rules keep unresolved calls, but not foreign ones', () => {
    const [mongooseCall, ownCall, untypedCall] = updateCalls();

    assert.equal(mayCallMongoose(mongooseCall!), true);
    assert.equal(mayCallMongoose(ownCall!), false);
    // Untyped code is where these bugs hide; a report must not discard it.
    assert.equal(mayCallMongoose(untypedCall!), true);
  });
});
