/**
 * `--json`, for CI.
 *
 * Deliberately flatter than the internal model: one findings array with the
 * hop on each entry, so a pipeline can filter on category without walking a
 * tree. The `summary` block exists so the common check — "did anything land in
 * SEMANTIC?" — is one field access, not a reduce.
 */

import {
  allFindings,
  countAutoFixable,
  countByCategory,
  affectedFiles,
  type ApplyReport,
  type ScanReport,
} from '../../domain/index.ts';

export function scanToJson(report: ScanReport): string {
  return `${JSON.stringify(scanPayload(report), null, 2)}\n`;
}

export function applyToJson(report: ApplyReport): string {
  return `${JSON.stringify(
    {
      command: 'apply',
      dryRun: report.dryRun,
      ...scanPayload(report.scan),
      fixed: report.fixed,
      fixedSites: report.fixed.reduce((total, summary) => total + summary.sites, 0),
      remaining: report.remaining,
      filesChanged: report.changes.map((change) => change.file),
    },
    null,
    2,
  )}\n`;
}

function scanPayload(report: ScanReport) {
  const findings = allFindings(report);
  return {
    version: 1,
    root: report.root,
    from: report.from,
    to: report.to,
    startedAt: report.startedAt,
    durationMs: Math.round(report.durationMs),
    filesScanned: report.filesScanned,
    summary: {
      findings: findings.length,
      filesAffected: affectedFiles(findings),
      mechanical: countByCategory(findings, 'MECHANICAL'),
      semantic: countByCategory(findings, 'SEMANTIC'),
      autoFixable: countAutoFixable(findings),
    },
    hops: report.hops.map((hop) => ({
      hop: hop.hopId,
      coverage: hop.coverage,
      rulesRun: hop.rulesRun,
      findings: hop.findings.length,
    })),
    findings,
  };
}
