import type { ScanReport } from './report.ts';
import { allFindings } from './report.ts';

/**
 * 0 clean · 1 changes pending · 2 error.
 *
 * `1` means "there is work to do", not "the tool failed" — which is what makes
 * `mongoose-codemod scan` usable as a CI gate against upgrade drift.
 */
export const EXIT = { CLEAN: 0, PENDING: 1, ERROR: 2 } as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

export function exitCodeFor(report: ScanReport): ExitCode {
  return allFindings(report).length > 0 ? EXIT.PENDING : EXIT.CLEAN;
}
