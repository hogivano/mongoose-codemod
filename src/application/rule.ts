/**
 * The rule contract, and the three constructors that are the only way to make
 * one. Rules are data — `{id, hop, category, detect, transform?}` —
 * so they are testable in isolation and cheap to contribute.
 *
 * The central invariant is enforced by the types here, not by a review comment:
 * only `defineAutoFix` produces a rule that carries a `transform`. A SEMANTIC
 * rule has nowhere to put one, so `apply` cannot rewrite one by mistake.
 */

import type { Node, SourceFile } from 'ts-morph';
import type { Hop, RuleMeta } from '../domain/index.ts';

/**
 * One site a rule matched. `node` supplies the location and the snippet.
 *
 * Generic in the node type so a rule that detects `PropertyAssignment`s gets a
 * `PropertyAssignment` in its transform, with no cast at the top of every rule.
 */
export interface RuleMatch<N extends Node = Node> {
  readonly node: N;
  /** Detail this rule knows about this particular site. Shown under it. */
  readonly note?: string;
}

interface RuleBase<N extends Node = Node> {
  readonly meta: RuleMeta;
  /** Pure read. Must not mutate the AST — `scan` and `apply` both call it. */
  detect(file: SourceFile): RuleMatch<N>[];
}

/** MECHANICAL and provably rewritable. The only shape with a `transform`. */
export interface AutoFixRule<N extends Node = Node> extends RuleBase<N> {
  readonly meta: RuleMeta & { category: 'MECHANICAL'; fix: 'auto' };
  /**
   * Rewrite one match. Returns false when this particular site turned out not
   * to be safe after all — the finding is then reported as remaining work.
   * Never throws for an unexpected shape: return false instead.
   */
  transform(match: RuleMatch<N>): boolean;
}

/** MECHANICAL, but no rewrite is correct in general. Reported, never touched. */
export interface ManualRule<N extends Node = Node> extends RuleBase<N> {
  readonly meta: RuleMeta & { category: 'MECHANICAL'; fix: 'manual' };
  readonly transform?: never;
}

/** Behaviour changed silently. Reported, never touched. The point of the tool. */
export interface SemanticRule<N extends Node = Node> extends RuleBase<N> {
  readonly meta: RuleMeta & { category: 'SEMANTIC'; fix: 'never' };
  readonly transform?: never;
}

export type Rule = AutoFixRule | ManualRule | SemanticRule;

export function canTransform(rule: Rule): rule is AutoFixRule {
  return rule.meta.fix === 'auto';
}

/** Fields every constructor takes; category and fix are supplied by the constructor. */
interface RuleSpec<N extends Node> {
  id: string;
  hop: Hop;
  title: string;
  explain: string;
  docs?: string;
  detect(file: SourceFile): RuleMatch<N>[];
}

export function defineAutoFix<N extends Node>(
  spec: RuleSpec<N> & { transform(match: RuleMatch<N>): boolean },
): AutoFixRule<N> {
  return { meta: meta(spec, 'MECHANICAL', 'auto'), detect: spec.detect, transform: spec.transform };
}

export function defineManual<N extends Node>(spec: RuleSpec<N>): ManualRule<N> {
  return { meta: meta(spec, 'MECHANICAL', 'manual'), detect: spec.detect };
}

export function defineSemantic<N extends Node>(spec: RuleSpec<N>): SemanticRule<N> {
  return { meta: meta(spec, 'SEMANTIC', 'never'), detect: spec.detect };
}

function meta<C extends 'MECHANICAL' | 'SEMANTIC', F extends 'auto' | 'manual' | 'never'>(
  spec: { id: string; hop: Hop; title: string; explain: string; docs?: string },
  category: C,
  fix: F,
): RuleMeta & { category: C; fix: F } {
  return {
    id: spec.id,
    hop: spec.hop,
    category,
    fix,
    title: spec.title,
    explain: dedent(spec.explain),
    ...(spec.docs === undefined ? {} : { docs: spec.docs }),
  };
}

/** Rule explanations are written as indented template literals; print them flush. */
function dedent(text: string): string {
  const lines = text.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
  const indent = Math.min(
    ...lines.filter((line) => line.trim()).map((line) => line.length - line.trimStart().length),
  );
  return lines.map((line) => line.slice(indent)).join('\n');
}
