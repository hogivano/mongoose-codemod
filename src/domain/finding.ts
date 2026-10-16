/** One call site a rule matched. The atom of every report. */

import type { HopId } from './hop.ts';
import type { FixPolicy, RuleCategory } from './rule.ts';

export interface SourceLocation {
  /** Path relative to the scan root — reports must not leak absolute paths. */
  readonly file: string;
  readonly line: number;
  readonly column: number;
}

export interface Finding {
  readonly ruleId: string;
  readonly hop: HopId;
  readonly category: RuleCategory;
  readonly fix: FixPolicy;
  /** Copied from the rule so a single finding is readable on its own. */
  readonly title: string;
  readonly location: SourceLocation;
  /** The matched source, one line, trimmed. The evidence for the finding. */
  readonly snippet: string;
  /** Rule-specific detail, when the rule knows something about this site. */
  readonly note?: string;
  /** Set by `apply`: true when this site was actually rewritten. */
  readonly fixed?: boolean;
}

export function locationOf(finding: Finding): string {
  return `${finding.location.file}:${finding.location.line}:${finding.location.column}`;
}

/** Stable ordering for output: by file, then position. Reports must be diffable. */
export function compareFindings(a: Finding, b: Finding): number {
  return (
    a.location.file.localeCompare(b.location.file) ||
    a.location.line - b.location.line ||
    a.location.column - b.location.column ||
    a.ruleId.localeCompare(b.ruleId)
  );
}
