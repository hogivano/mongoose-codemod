/**
 * Library entry point.
 *
 * Layer by layer, so an importer can see the architecture from the export list:
 * the domain is pure, the application depends only on the domain and its own
 * ports, and the infrastructure is where ts-morph and git live.
 */

export * from './domain/index.ts';
export * from './application/index.ts';
export { createCodebase } from './infrastructure/codebase/ts-morph-codebase.ts';
export { createWorkingTree } from './infrastructure/git/exec-working-tree.ts';
export { createSystemClock } from './infrastructure/system-clock.ts';
export { ALL_RULES, createRuleRegistry } from './infrastructure/rules/registry.ts';
export { HOP_5_6_RULES } from './infrastructure/rules/hop-5-6/index.ts';
export { HOP_6_7_RULES } from './infrastructure/rules/hop-6-7/index.ts';
export { formatScan, formatApply } from './presentation/report/human.ts';
export { scanToJson, applyToJson } from './presentation/report/json.ts';
export { formatDiff } from './presentation/report/diff.ts';
