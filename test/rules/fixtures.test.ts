/**
 * Fixture-driven, per rule.
 *
 * For every auto-fixable rule: a before.ts, an after.ts, and the rule run in
 * isolation via --only, so a failure names exactly one rule.
 *
 * The last test is the important one. If a SEMANTIC rule ever produces a
 * transformation, that is a test failure — not a diff to review.
 */

import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { apply, scan } from '../../src/application/index.ts';
import { createRuleRegistry } from '../../src/infrastructure/rules/registry.ts';
import { fixedClock, inMemoryCodebase, stubWorkingTree } from '../support/in-memory-codebase.ts';
import type { Major } from '../../src/domain/index.ts';

const HOPS: ReadonlyArray<{ dir: string; from: Major; to: Major }> = [
  { dir: 'hop-5-6', from: 5, to: 6 },
  { dir: 'hop-6-7', from: 6, to: 7 },
];

function fixture(dir: string, name: string): string {
  return readFileSync(new URL(`../fixtures/${dir}/${name}`, import.meta.url), 'utf8');
}

function rulesWithFixtures(dir: string): string[] {
  return readdirSync(new URL(`../fixtures/${dir}`, import.meta.url))
    .filter((file) => file.endsWith('.before.ts'))
    .map((file) => file.replace('.before.ts', ''))
    .sort();
}

for (const { dir, from, to } of HOPS) {
  describe(`${from} → ${to} transforms`, () => {
    for (const ruleId of rulesWithFixtures(dir)) {
      it(`${ruleId} rewrites its fixture exactly`, async () => {
        const codebase = inMemoryCodebase({ 'input.ts': fixture(dir, `${ruleId}.before.ts`) });

        await apply(
          {
            codebase,
            registry: createRuleRegistry(),
            clock: fixedClock(),
            workingTree: stubWorkingTree(true),
          },
          { from, to, only: [ruleId] },
        );

        assert.equal(codebase.textOf('input.ts'), fixture(dir, `${ruleId}.after.ts`));
      });
    }

    it('scan never writes', () => {
      const files = Object.fromEntries(
        rulesWithFixtures(dir).map((ruleId) => [
          `${ruleId}.ts`,
          fixture(dir, `${ruleId}.before.ts`),
        ]),
      );
      const codebase = inMemoryCodebase(files);

      scan({ codebase, registry: createRuleRegistry(), clock: fixedClock() }, { from, to });

      assert.deepEqual(codebase.pendingChanges(), []);
      assert.equal(codebase.saved(), false);
    });

    it('apply leaves every SEMANTIC site untouched', async () => {
      const before = fixture(dir, 'semantic.ts');
      const codebase = inMemoryCodebase({ 'input.ts': before });

      const report = await apply(
        {
          codebase,
          registry: createRuleRegistry(),
          clock: fixedClock(),
          workingTree: stubWorkingTree(true),
        },
        { from, to },
      );

      const semantic = report.scan.hops.flatMap((hop) =>
        hop.findings.filter((finding) => finding.category === 'SEMANTIC'),
      );
      assert.ok(semantic.length > 0, 'fixture should contain semantic findings');

      // Every one of them comes back as remaining work, and the file is intact.
      for (const finding of semantic) {
        assert.ok(
          report.remaining.some(
            (item) =>
              item.ruleId === finding.ruleId && item.location.line === finding.location.line,
          ),
          `${finding.ruleId} was not reported as remaining work`,
        );
      }
      assert.equal(codebase.textOf('input.ts'), before);
    });
  });
}
