/**
 * The invariants that make the report trustworthy, asserted against the real
 * rule set rather than a fixture — a new rule that breaks one fails here.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ALL_RULES, createRuleRegistry } from '../../src/infrastructure/rules/registry.ts';
import { canTransform } from '../../src/application/rule.ts';
import { hopId } from '../../src/domain/index.ts';

describe('rule registry', () => {
  it('builds, which runs every invariant check', () => {
    assert.ok(createRuleRegistry().all().length > 0);
  });

  it('gives no SEMANTIC rule a transform', () => {
    for (const rule of ALL_RULES) {
      if (rule.meta.category !== 'SEMANTIC') continue;
      assert.equal(rule.meta.fix, 'never', `${rule.meta.id} must be fix: never`);
      assert.equal(canTransform(rule), false, `${rule.meta.id} must not be transformable`);
      assert.equal('transform' in rule, false, `${rule.meta.id} must have no transform`);
    }
  });

  it('gives every auto rule a transform, and no other rule one', () => {
    for (const rule of ALL_RULES) {
      const hasTransform = 'transform' in rule && typeof rule.transform === 'function';
      assert.equal(hasTransform, rule.meta.fix === 'auto', `${rule.meta.id}`);
    }
  });

  it('keeps rule ids unique', () => {
    const ids = ALL_RULES.map((rule) => rule.meta.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('gives every rule an explanation and a docs link', () => {
    for (const rule of ALL_RULES) {
      assert.ok(rule.meta.explain.trim().length > 20, `${rule.meta.id} needs a real explanation`);
      assert.ok(rule.meta.docs, `${rule.meta.id} needs a docs link`);
    }
  });

  it('scopes every rule to a single hop', () => {
    for (const rule of ALL_RULES) {
      assert.equal(rule.meta.hop.to, rule.meta.hop.from + 1, hopId(rule.meta.hop));
    }
  });

  it('reports hops with no rules as uncovered rather than clean', () => {
    const registry = createRuleRegistry();
    assert.deepEqual(registry.rulesFor({ from: 7, to: 8 }), []);
    assert.deepEqual([...registry.coveredHops()], ['5->6', '6->7']);
  });
});
