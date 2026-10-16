/** Turning an AST match into a Finding: the one place location and snippet are read. */

import type { Finding, HopId } from '../domain/index.ts';
import { hopId } from '../domain/index.ts';
import type { CodebasePort } from './ports.ts';
import type { Rule, RuleMatch } from './rule.ts';
import type { SourceFile } from 'ts-morph';

const SNIPPET_MAX = 100;

export function toFinding(
  rule: Rule,
  match: RuleMatch,
  file: SourceFile,
  codebase: CodebasePort,
): Finding {
  const start = match.node.getStart();
  const { line, column } = file.getLineAndColumnAtPos(start);
  return {
    ruleId: rule.meta.id,
    hop: hopId(rule.meta.hop) as HopId,
    category: rule.meta.category,
    fix: rule.meta.fix,
    title: rule.meta.title,
    location: { file: codebase.relativePath(file), line, column },
    snippet: snippetAt(file, line),
    ...(match.note === undefined ? {} : { note: match.note }),
  };
}

/**
 * The whole source line, trimmed — not the node's own text. A node's text can
 * be a bare identifier; the line is what the reader will look at in their editor.
 */
function snippetAt(file: SourceFile, line: number): string {
  const text = file.getFullText().split('\n')[line - 1] ?? '';
  const trimmed = text.trim();
  return trimmed.length > SNIPPET_MAX ? `${trimmed.slice(0, SNIPPET_MAX - 1)}…` : trimmed;
}
