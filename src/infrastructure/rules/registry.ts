/**
 * The rule registry.
 *
 * Every invariant that types cannot express is checked here, once, when the
 * registry is built — so a broken rule fails on the first command rather than
 * on someone's production upgrade.
 *
 * Hops 7→8 and 8→9 are deliberately absent, not empty-by-accident: they have
 * not been researched yet, and `scan` reports that as a gap rather
 * than as a clean bill of health.
 */

import { assertFixPolicy, hopId, type Hop, type HopId } from '../../domain/index.ts';
import type { RuleRegistryPort } from '../../application/ports.ts';
import type { Rule } from '../../application/rule.ts';
import { HOP_5_6_RULES } from './hop-5-6/index.ts';
import { HOP_6_7_RULES } from './hop-6-7/index.ts';

/** Every rule, in hop order then report order. */
export const ALL_RULES: readonly Rule[] = [...HOP_5_6_RULES, ...HOP_6_7_RULES];

export function createRuleRegistry(rules: readonly Rule[] = ALL_RULES): RuleRegistryPort {
  validate(rules);

  const byHop = new Map<HopId, Rule[]>();
  for (const rule of rules) {
    const key = hopId(rule.meta.hop);
    const bucket = byHop.get(key);
    if (bucket) bucket.push(rule);
    else byHop.set(key, [rule]);
  }

  return {
    all: () => rules,
    rulesFor: (hop: Hop) => byHop.get(hopId(hop)) ?? [],
    coveredHops: () => [...byHop.keys()],
  };
}

function validate(rules: readonly Rule[]): void {
  const seen = new Set<string>();
  for (const rule of rules) {
    assertFixPolicy(rule.meta);

    if (seen.has(rule.meta.id)) {
      throw new Error(`duplicate rule id: ${rule.meta.id}`);
    }
    seen.add(rule.meta.id);

    // The invariant, checked at runtime as well as in the types: nothing that
    // is not MECHANICAL/auto may carry a transform.
    const transformable = rule.meta.fix === 'auto';
    if (transformable !== ('transform' in rule && typeof rule.transform === 'function')) {
      throw new Error(
        `rule ${rule.meta.id}: fix is '${rule.meta.fix}' but transform is ` +
          `${'transform' in rule ? 'present' : 'absent'}`,
      );
    }

    if (rule.meta.hop.to !== rule.meta.hop.from + 1) {
      throw new Error(`rule ${rule.meta.id}: ${hopId(rule.meta.hop)} is not a single hop`);
    }
  }
}
