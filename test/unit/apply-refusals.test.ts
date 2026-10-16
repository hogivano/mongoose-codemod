/**
 * The refusals are the product. Each one is asserted here, including
 * that it explains itself — an error with no hint is a failure of the tool's
 * whole argument.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { apply } from '../../src/application/index.ts';
import { DirtyWorkingTreeError, MultiHopApplyError } from '../../src/domain/index.ts';
import { createRuleRegistry } from '../../src/infrastructure/rules/registry.ts';
import { fixedClock, inMemoryCodebase, stubWorkingTree } from '../support/in-memory-codebase.ts';

const SOURCE = `import mongoose from 'mongoose';\nawait mongoose.connect(url, { useNewUrlParser: true });\n`;

function deps(clean: boolean) {
  const codebase = inMemoryCodebase({ 'input.ts': SOURCE });
  return {
    codebase,
    registry: createRuleRegistry(),
    clock: fixedClock(),
    workingTree: stubWorkingTree(clean),
  };
}

describe('apply refusals', () => {
  it('refuses more than one hop, and says how to proceed', async () => {
    const error = await apply(deps(true), { from: 5, to: 7 }).catch((e: unknown) => e);
    assert.ok(error instanceof MultiHopApplyError);
    assert.match(error.message, /one major at a time/);
    assert.match(error.hint ?? '', /--from 5 --to 6/);
  });

  it('refuses an unclean working tree, and says how to proceed', async () => {
    const error = await apply(deps(false), { from: 5, to: 6 }).catch((e: unknown) => e);
    assert.ok(error instanceof DirtyWorkingTreeError);
    assert.match(error.hint ?? '', /--dry-run/);
  });

  it('allows an unclean tree with --force', async () => {
    const report = await apply(deps(false), { from: 5, to: 6, force: true });
    assert.equal(report.fixed[0]?.sites, 1);
  });

  it('allows an unclean tree for --dry-run, and writes nothing', async () => {
    const d = deps(false);
    const report = await apply(d, { from: 5, to: 6, dryRun: true });

    assert.equal(report.dryRun, true);
    assert.equal(report.fixed[0]?.sites, 1);
    assert.equal(report.changes.length, 1, 'the change is computed so it can be shown');
    assert.equal(d.codebase.saved(), false, 'but nothing is written');
  });

  it('does not report a rewritten site as still remaining', async () => {
    // Regression: two rules rewriting the same object literal shift each
    // other's line numbers, so remaining work has to be re-scanned rather than
    // subtracted from the first scan by position.
    const source = [
      `import mongoose from 'mongoose';`,
      `await mongoose.connect(url, {`,
      `  useNewUrlParser: true,`,
      `  useUnifiedTopology: true,`,
      `  poolSize: 10,`,
      `});`,
      ``,
    ].join('\n');

    const d = {
      codebase: inMemoryCodebase({ 'input.ts': source }),
      registry: createRuleRegistry(),
      clock: fixedClock(),
      workingTree: stubWorkingTree(true),
    };
    const report = await apply(d, { from: 5, to: 6 });

    const fixedRules = report.fixed.map((summary) => summary.ruleId);
    assert.deepEqual(fixedRules.sort(), ['connect-options-removed', 'pool-size-renamed']);

    for (const finding of report.remaining) {
      assert.ok(
        !fixedRules.includes(finding.ruleId),
        `${finding.ruleId} was rewritten but still reported as remaining`,
      );
    }
  });

  it('points remaining work at the file as it now stands', async () => {
    // strictQuery anchors on the connect() call, which moves up four lines once
    // the removed options are gone. The remaining finding must follow it.
    const source = [
      `import mongoose from 'mongoose';`,
      `await mongoose.connect(url, {`,
      `  useNewUrlParser: true,`,
      `  useUnifiedTopology: true,`,
      `  useCreateIndex: true,`,
      `});`,
      ``,
    ].join('\n');

    const codebase = inMemoryCodebase({ 'input.ts': source });
    const report = await apply(
      {
        codebase,
        registry: createRuleRegistry(),
        clock: fixedClock(),
        workingTree: stubWorkingTree(true),
      },
      { from: 5, to: 6 },
    );

    const strictQuery = report.remaining.find((f) => f.ruleId === 'strict-query-default');
    assert.ok(strictQuery, 'strictQuery should still need review');

    const line = codebase.textOf('input.ts').split('\n')[strictQuery.location.line - 1];
    assert.match(line ?? '', /mongoose\.connect/);
  });

  it('writes only when there is something to write', async () => {
    const d = {
      codebase: inMemoryCodebase({ 'clean.ts': `import mongoose from 'mongoose';\n` }),
      registry: createRuleRegistry(),
      clock: fixedClock(),
      workingTree: stubWorkingTree(true),
    };
    await apply(d, { from: 5, to: 6 });
    assert.equal(d.codebase.saved(), false);
  });
});
