/**
 * `list` — show every rule and its category.
 *
 * This is the tool explaining itself. Someone deciding whether to trust a
 * report should be able to read the whole rule set in one screen, including
 * the hops that have no rules yet.
 */

import type { HopId, Major, RuleMeta } from '../../domain/index.ts';
import { formatHop, hopId, hopsBetween } from '../../domain/index.ts';
import type { RuleRegistryPort } from '../ports.ts';

export interface HopRules {
  readonly hopId: HopId;
  readonly label: string;
  readonly rules: readonly RuleMeta[];
}

export interface ListRulesRequest {
  /** Limit to the hops between these majors. Omit for everything known. */
  from?: Major;
  to?: Major;
}

export function listRules(registry: RuleRegistryPort, request: ListRulesRequest = {}): HopRules[] {
  const hops =
    request.from !== undefined && request.to !== undefined
      ? hopsBetween(request.from, request.to)
      : hopsBetween(5, 9);

  return hops.map((hop) => ({
    hopId: hopId(hop),
    label: formatHop(hop),
    rules: registry.rulesFor(hop).map((rule) => rule.meta),
  }));
}
