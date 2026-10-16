/**
 * Report aggregates, and the pure functions that summarise them.
 *
 * Nothing here does I/O or formatting: `scan` builds these, the presentation
 * layer renders them, and tests assert on them directly.
 */

import { compareFindings, type Finding } from './finding.ts';
import type { Hop, HopId, Major } from './hop.ts';
import type { RuleCategory } from './rule.ts';

/** How much of a hop we actually know about. Absent rules must be visible. */
export type HopCoverage = 'covered' | 'not-yet-researched';

export interface HopReport {
  readonly hop: Hop;
  readonly hopId: HopId;
  readonly coverage: HopCoverage;
  /** Rules evaluated for this hop. Zero when coverage is not-yet-researched. */
  readonly rulesRun: number;
  readonly findings: readonly Finding[];
}

export interface ScanReport {
  readonly root: string;
  readonly from: Major;
  readonly to: Major;
  readonly filesScanned: number;
  readonly startedAt: string;
  readonly durationMs: number;
  readonly hops: readonly HopReport[];
}

export interface FileChange {
  readonly file: string;
  readonly before: string;
  readonly after: string;
}

/**
 * What one rule rewrote. Counts rather than locations, deliberately: a site's
 * line number changes the moment an earlier rule rewrites something above it,
 * so a "fixed at line 8" would point somewhere the code no longer is. The
 * before-state lives in `scan`, the after-state in `remaining`, and this sits
 * between them as a tally.
 */
export interface FixSummary {
  readonly ruleId: string;
  readonly title: string;
  readonly sites: number;
  readonly files: number;
}

export interface ApplyReport {
  readonly scan: ScanReport;
  /** True when nothing was written to disk (--dry-run). */
  readonly dryRun: boolean;
  readonly changes: readonly FileChange[];
  /** What was rewritten, per rule. */
  readonly fixed: readonly FixSummary[];
  /**
   * What is still there, re-scanned after the rewrites — so the locations point
   * into the file as it now stands. Semantic findings, mechanical ones with no
   * automatic fix, and any site a transform declined.
   */
  readonly remaining: readonly Finding[];
}

export function allFindings(report: ScanReport): Finding[] {
  return report.hops.flatMap((hop) => hop.findings).sort(compareFindings);
}

export function countByCategory(findings: readonly Finding[], category: RuleCategory): number {
  return findings.filter((finding) => finding.category === category).length;
}

export function countAutoFixable(findings: readonly Finding[]): number {
  return findings.filter((finding) => finding.fix === 'auto').length;
}

/** Findings grouped by rule, preserving report order within each group. */
export function groupByRule(findings: readonly Finding[]): Map<string, Finding[]> {
  const groups = new Map<string, Finding[]>();
  for (const finding of [...findings].sort(compareFindings)) {
    const group = groups.get(finding.ruleId);
    if (group) group.push(finding);
    else groups.set(finding.ruleId, [finding]);
  }
  return groups;
}

export function affectedFiles(findings: readonly Finding[]): number {
  return new Set(findings.map((finding) => finding.location.file)).size;
}
