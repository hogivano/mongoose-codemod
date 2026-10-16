/**
 * The taxonomy. This file is the product — everything else is plumbing.
 *
 *   MECHANICAL  syntax changed, meaning did not   → safe to transform
 *   SEMANTIC    runtime behaviour changed quietly → never transform, only report
 *
 * Anyone can grep for `.count(`. Knowing which changes silently alter what your
 * code does is the expertise, and it is the reason upgrades stall.
 */

import type { Hop } from './hop.ts';

export type RuleCategory = 'MECHANICAL' | 'SEMANTIC';

/**
 * What `apply` is allowed to do with a rule.
 *
 *   auto    the rewrite is provably correct; `apply` performs it
 *   manual  the syntax genuinely changed, but no rewrite is correct in general
 *           (e.g. `mapReduce()` needs a real aggregation). Reported with
 *           instructions, never rewritten.
 *   never   SEMANTIC. Touching it could change behaviour silently.
 *
 * `manual` exists so the report can never overpromise: the count of "apply will
 * fix these" is exactly the count of `auto` sites, not of mechanical ones.
 */
export type FixPolicy = 'auto' | 'manual' | 'never';

export interface RuleMeta {
  /** Stable kebab-case id, unique across all hops. Appears in --json and --only. */
  readonly id: string;
  readonly hop: Hop;
  readonly category: RuleCategory;
  readonly fix: FixPolicy;
  /** One line, the change itself. e.g. "Model.count() → countDocuments()". */
  readonly title: string;
  /** What changed, and what the reader has to do about it. Shown in the report. */
  readonly explain: string;
  /** Link into the official migration guide, so a finding can be verified. */
  readonly docs?: string;
}

/**
 * The invariant the whole tool rests on: a SEMANTIC rule is never rewritten.
 * Types enforce this at the rule-definition site (see application/rule.ts);
 * this is the runtime backstop, asserted once when the registry is built.
 */
export function assertFixPolicy(meta: RuleMeta): void {
  if (meta.category === 'SEMANTIC' && meta.fix !== 'never') {
    throw new Error(`rule ${meta.id}: SEMANTIC rules must declare fix: 'never'`);
  }
  if (meta.category === 'MECHANICAL' && meta.fix === 'never') {
    throw new Error(`rule ${meta.id}: MECHANICAL rules are 'auto' or 'manual', not 'never'`);
  }
}

export function isAutoFixable(meta: RuleMeta): boolean {
  return meta.fix === 'auto';
}
