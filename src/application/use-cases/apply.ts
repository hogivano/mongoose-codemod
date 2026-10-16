/**
 * `apply` — transform MECHANICAL/auto sites, and nothing else.
 *
 * Three refusals are load-bearing, and each one prints why:
 *   1. one hop at a time — the test suite has to be green in between
 *   2. a clean git tree, unless --force — the diff has to stay reviewable
 *   3. never a SEMANTIC rule — the types make that unrepresentable, and the
 *      remaining work is re-printed afterwards instead
 */

import type { SourceFile } from 'ts-morph';
import type { ApplyReport, Finding, FixSummary, Hop, Major } from '../../domain/index.ts';
import {
  DirtyWorkingTreeError,
  MultiHopApplyError,
  allFindings,
  compareFindings,
  hopsBetween,
  isSingleHop,
} from '../../domain/index.ts';
import { toFinding } from '../findings.ts';
import type { WorkingTreePort } from '../ports.ts';
import { canTransform, type AutoFixRule, type RuleMatch } from '../rule.ts';
import { scan, type ScanDeps, type ScanRequest } from './scan.ts';

export interface ApplyDeps extends ScanDeps {
  workingTree: WorkingTreePort;
}

export interface ApplyRequest {
  from: Major;
  to: Major;
  /** Show the diff, write nothing. */
  dryRun?: boolean;
  /** Skip the clean-tree check. The user is on their own. */
  force?: boolean;
  only?: readonly string[];
}

export async function apply(deps: ApplyDeps, request: ApplyRequest): Promise<ApplyReport> {
  const hops = hopsBetween(request.from, request.to);
  if (!isSingleHop(request.from, request.to)) {
    const first = hops[0]!;
    throw new MultiHopApplyError(
      `apply runs one major at a time; ${request.from} → ${request.to} is ${hops.length} hops`,
      `Start with --from ${first.from} --to ${first.to}, run your test suite, commit, ` +
        `then do the next hop.\n` +
        `\`scan --from ${request.from} --to ${request.to}\` shows the whole road first.`,
    );
  }

  if (request.dryRun !== true && request.force !== true && !(await deps.workingTree.isClean())) {
    throw new DirtyWorkingTreeError(
      `refusing to rewrite files: ${await deps.workingTree.describe()}`,
      'Commit or stash first, so the codemod diff is reviewable on its own.\n' +
        'Or use --dry-run to see the changes, or --force to proceed anyway.',
    );
  }

  // Scanned twice, on purpose.
  //
  // The first scan is the report: what was true before anything moved. The
  // second is the remaining work, and it has to run after the rewrites because
  // rewriting shifts every line below it — a leftover site described by its
  // pre-change position sends the reader to the wrong line of the file they now
  // have on disk. Re-scanning also means "what is left" is measured rather than
  // inferred by subtracting one list from another.
  const report = scan(deps, scanRequest(request));
  const fixed = summarise(transformHop(deps, hops[0]!, request.only));
  const remaining = allFindings(scan(deps, scanRequest(request)));
  const changes = deps.codebase.pendingChanges();

  if (request.dryRun !== true && changes.length > 0) await deps.codebase.save();

  return { scan: report, dryRun: request.dryRun === true, changes, fixed, remaining };
}

function scanRequest(request: ApplyRequest): ScanRequest {
  return request.only === undefined
    ? { from: request.from, to: request.to }
    : { from: request.from, to: request.to, only: request.only };
}

/**
 * Rewrite every auto-fixable site, one rule at a time.
 *
 * Two ordering rules make this safe:
 *   - detect immediately before transforming, per rule, so each rule sees the
 *     text the rule before it left behind;
 *   - transform matches back-to-front, because rewriting a node invalidates
 *     positions after it but never before it.
 */
function transformHop(deps: ApplyDeps, hop: Hop, only: readonly string[] | undefined): Finding[] {
  const rules = deps.registry
    .rulesFor(hop)
    .filter(canTransform)
    .filter((rule) => only === undefined || only.includes(rule.meta.id));

  const fixed: Finding[] = [];

  for (const file of deps.codebase.sourceFiles()) {
    for (const rule of rules) fixed.push(...transformRuleInFile(deps, rule, file));
  }

  return fixed.sort(compareFindings);
}

/**
 * Apply one rule to one file, back-to-front.
 *
 * The complication is that rules editing by position — the ones that must not
 * let the printer re-indent a multi-line node — invalidate every node in the
 * file, including the matches still queued up. When that happens the rule is
 * simply re-detected against the text as it now stands, and the walk resumes
 * from the same distance off the end. Declined sites accumulate at that tail,
 * so they are never retried and the loop always terminates.
 */
function transformRuleInFile(
  deps: ApplyDeps,
  rule: AutoFixRule,
  file: SourceFile,
): Finding[] {
  const fixed: Finding[] = [];
  const toFindings = (matches: readonly RuleMatch[]) =>
    matches.map((match) => toFinding(rule, match, file, deps.codebase));

  let matches = rule.detect(file);
  // Built before this rule's own rewrites, so the positions are the ones this
  // rule saw. They are only ever counted and grouped, never printed as
  // locations — earlier rules in this same pass may already have moved them.
  let findings = toFindings(matches);
  let declined = 0;
  let index = matches.length - 1;

  while (index >= 0) {
    if (matches[index]!.node.wasForgotten()) {
      matches = rule.detect(file);
      findings = toFindings(matches);
      index = matches.length - 1 - declined;
      if (index < 0) break;
    }

    const before = matches.length;
    if (transformSafely(rule, matches[index]!)) {
      fixed.push(findings[index]!);
      // A "successful" transform that leaves its own site still matching would
      // loop forever. Treat it as declined instead — the site is reported as
      // remaining work, which is the honest outcome for a rule that did not do
      // what it claimed.
      if (!matches[index]!.node.wasForgotten() && rule.detect(file).length === before) {
        declined++;
      }
    } else {
      declined++;
    }
    index--;
  }

  return fixed;
}

/** Collapse the rewritten sites into one row per rule, in report order. */
function summarise(fixed: readonly Finding[]): FixSummary[] {
  const summaries = new Map<string, { title: string; sites: number; files: Set<string> }>();

  for (const finding of fixed) {
    const existing = summaries.get(finding.ruleId);
    if (existing) {
      existing.sites++;
      existing.files.add(finding.location.file);
    } else {
      summaries.set(finding.ruleId, {
        title: finding.title,
        sites: 1,
        files: new Set([finding.location.file]),
      });
    }
  }

  return [...summaries].map(([ruleId, summary]) => ({
    ruleId,
    title: summary.title,
    sites: summary.sites,
    files: summary.files.size,
  }));
}

/**
 * A rule that throws mid-rewrite must not take the run with it. The site is
 * simply left alone and reported as remaining work — which is the honest
 * outcome, since we do not know what state it is in.
 */
function transformSafely(rule: AutoFixRule, match: RuleMatch): boolean {
  try {
    return rule.transform(match);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `mongoose-codemod: rule ${rule.meta.id} could not rewrite a site: ${reason}\n`,
    );
    return false;
  }
}
