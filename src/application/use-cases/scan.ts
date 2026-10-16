/**
 * `scan` — the default posture, and the one that never writes.
 *
 * Runs every rule for every hop between --from and --to, in hop order, and
 * reports what it found. Hops with no rules yet are reported as gaps rather
 * than as clean: silence about an unresearched version would be a lie.
 */

import type { Finding, Hop, Major, ScanReport, HopReport } from '../../domain/index.ts';
import { compareFindings, hopId, hopsBetween } from '../../domain/index.ts';
import { toFinding } from '../findings.ts';
import type { ClockPort, CodebasePort, RuleRegistryPort } from '../ports.ts';
import type { Rule } from '../rule.ts';

export interface ScanDeps {
  codebase: CodebasePort;
  registry: RuleRegistryPort;
  clock: ClockPort;
}

export interface ScanRequest {
  from: Major;
  to: Major;
  /** Restrict to these rule ids. Everything else is skipped. */
  only?: readonly string[];
}

export function scan(deps: ScanDeps, request: ScanRequest): ScanReport {
  const startedAt = deps.clock.now().toISOString();
  const startMs = deps.clock.elapsedMs();
  const files = deps.codebase.sourceFiles();

  const hops = hopsBetween(request.from, request.to).map((hop) =>
    scanHop(deps, hop, files, request.only),
  );

  return {
    root: deps.codebase.root,
    from: request.from,
    to: request.to,
    filesScanned: files.length,
    startedAt,
    durationMs: deps.clock.elapsedMs() - startMs,
    hops,
  };
}

function scanHop(
  deps: ScanDeps,
  hop: Hop,
  files: readonly ReturnType<CodebasePort['sourceFiles']>[number][],
  only: readonly string[] | undefined,
): HopReport {
  const available = deps.registry.rulesFor(hop);
  const rules = only ? available.filter((rule) => only.includes(rule.meta.id)) : available;
  const findings: Finding[] = [];

  for (const file of files) {
    for (const rule of rules) {
      for (const match of detectSafely(rule, file)) {
        findings.push(toFinding(rule, match, file, deps.codebase));
      }
    }
  }

  return {
    hop,
    hopId: hopId(hop),
    coverage: available.length > 0 ? 'covered' : 'not-yet-researched',
    rulesRun: rules.length,
    findings: findings.sort(compareFindings),
  };
}

/**
 * One rule tripping over an odd file must not lose the other 40 rules' results.
 * A crash here is a bug in that rule, so it is surfaced on stderr, not swallowed.
 */
function detectSafely(rule: Rule, file: Parameters<Rule['detect']>[0]) {
  try {
    return rule.detect(file);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    process.stderr.write(`mongoose-codemod: rule ${rule.meta.id} failed on a file: ${reason}\n`);
    return [];
  }
}
