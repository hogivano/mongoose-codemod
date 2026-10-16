/**
 * The report a person reads.
 *
 * The shape follows the taxonomy rather than the file system: MECHANICAL and
 * SEMANTIC are separated, counted separately, and never mixed in one list. If
 * someone reads only the first screen, the thing they must take away is how
 * many sites need a human, and why.
 */

import {
  affectedFiles,
  allFindings,
  countAutoFixable,
  formatHop,
  groupByRule,
  locationOf,
  type ApplyReport,
  type Finding,
  type FixSummary,
  type HopReport,
  type ScanReport,
} from '../../domain/index.ts';
import type { RuleRegistryPort } from '../../application/ports.ts';

const tty = () => process.stdout.isTTY === true;
const bold = (text: string) => (tty() ? `\u001b[1m${text}\u001b[0m` : text);
const dim = (text: string) => (tty() ? `\u001b[2m${text}\u001b[0m` : text);

export interface FormatOptions {
  /** Sites listed per rule before the rest are summarised. */
  maxSites?: number;
  /** Registry, so explanations can be looked up per rule. */
  registry: RuleRegistryPort;
}

const DEFAULT_MAX_SITES = 5;

export function formatScan(report: ScanReport, options: FormatOptions): string {
  const findings = allFindings(report);
  const lines: string[] = [
    '',
    `${bold('mongoose-codemod')} ${dim('scan')}  ${report.from} → ${report.to}  ${dim(report.root)}`,
    '',
    `  ${plural(report.filesScanned, 'file')} · ${plural(findings.length, 'affected call site')}` +
      (findings.length > 0 ? ` in ${plural(affectedFiles(findings), 'file')}` : ''),
    '',
  ];

  for (const hop of report.hops) lines.push(...formatHopSection(hop, options), '');

  lines.push(...summary(report, findings));
  return lines.join('\n');
}

function formatHopSection(hop: HopReport, options: FormatOptions): string[] {
  const heading = `  ${bold(formatHop(hop.hop))}`;

  if (hop.coverage === 'not-yet-researched') {
    return [
      heading,
      `    ${dim('no rules yet — this hop has not been researched.')}`,
      `    ${dim('Treat as unknown, not as clean: https://mongoosejs.com/docs/migrating_to_' + hop.hop.to + '.html')}`,
    ];
  }

  if (hop.findings.length === 0) {
    return [heading, `    ${dim(`nothing found (${plural(hop.rulesRun, 'rule')} checked)`)}`];
  }

  const mechanical = hop.findings.filter((finding) => finding.category === 'MECHANICAL');
  const semantic = hop.findings.filter((finding) => finding.category === 'SEMANTIC');
  const lines = [heading, ''];

  if (mechanical.length > 0) {
    const auto = countAutoFixable(mechanical);
    const note =
      auto === mechanical.length
        ? '`apply` will fix these'
        : auto === 0
          ? 'no automatic fix — see each rule'
          : `\`apply\` will fix ${auto}, the rest need a hand`;
    lines.push(`    ${bold(`MECHANICAL (${mechanical.length})`)} ${dim(`— ${note}`)}`, '');
    lines.push(...ruleGroups(mechanical, options, false), '');
  }

  if (semantic.length > 0) {
    lines.push(`    ${bold(`SEMANTIC (${semantic.length})`)} ${dim('— human review required')}  ⚠`, '');
    // Semantic findings always carry their explanation. The count alone is not
    // actionable, and the explanation is the entire value of the finding.
    lines.push(...ruleGroups(semantic, options, true));
  }

  return lines;
}

function ruleGroups(
  findings: readonly Finding[],
  options: FormatOptions,
  explain: boolean,
): string[] {
  const groups = groupByRule(findings);
  const width = Math.max(...[...groups.values()].map((group) => String(group.length).length));
  const lines: string[] = [];

  for (const [ruleId, group] of groups) {
    const first = group[0]!;
    // Only mechanical rules are tagged. A SEMANTIC finding is already under a
    // heading that says so, and calling it "manual" blurs the one distinction
    // the report exists to make.
    const marker = first.category === 'MECHANICAL' && first.fix === 'manual' ? dim('  [manual]') : '';
    lines.push(`      ${String(group.length).padStart(width)}  ${first.title}${marker}`);
    lines.push(`      ${' '.repeat(width)}  ${dim(ruleId)}`);

    if (explain) {
      const meta = options.registry.all().find((rule) => rule.meta.id === ruleId)?.meta;
      if (meta) lines.push('', indent(meta.explain, 10 + width));
      if (meta?.docs) lines.push('', `${' '.repeat(10 + width)}${dim(meta.docs)}`);
      lines.push('');
    }

    lines.push(...siteLines(group, options.maxSites ?? DEFAULT_MAX_SITES, 10 + width));
    lines.push('');
  }

  return lines;
}

function sites(summaries: readonly FixSummary[]): number {
  return summaries.reduce((total, summary) => total + summary.sites, 0);
}

function siteLines(group: readonly Finding[], max: number, pad: number): string[] {
  const shown = group.slice(0, max).map((finding) => {
    const note = finding.note ? `  ${dim(`(${finding.note})`)}` : '';
    return `${' '.repeat(pad)}${locationOf(finding)}${note}\n${' '.repeat(pad + 2)}${dim(finding.snippet)}`;
  });
  const hidden = group.length - shown.length;
  if (hidden > 0) shown.push(`${' '.repeat(pad)}${dim(`… and ${hidden} more`)}`);
  return shown;
}

function summary(report: ScanReport, findings: readonly Finding[]): string[] {
  if (findings.length === 0) {
    return [`  ${bold('Clean.')} No known breakage for ${report.from} → ${report.to}.`, ''];
  }

  const auto = countAutoFixable(findings);
  const semantic = findings.filter((finding) => finding.category === 'SEMANTIC').length;
  const first = report.hops[0]!;

  return [
    `  ${plural(findings.length, 'finding')} · ${auto} fixable automatically · ` +
      `${plural(semantic, 'site')} needing human review`,
    '',
    `  ${dim('Next:')} mongoose-codemod apply --from ${first.hop.from} --to ${first.hop.to} --dry-run`,
    `  ${dim('apply moves one major at a time, and never touches a SEMANTIC finding.')}`,
    '',
  ];
}

export function formatApply(report: ApplyReport, options: FormatOptions): string {
  const lines: string[] = [
    '',
    `${bold('mongoose-codemod')} ${dim(report.dryRun ? 'apply --dry-run' : 'apply')}  ` +
      `${report.scan.from} → ${report.scan.to}  ${dim(report.scan.root)}`,
    '',
  ];

  if (report.fixed.length === 0) {
    lines.push('  Nothing to rewrite.', '');
  } else {
    const verb = report.dryRun ? 'would rewrite' : 'rewrote';
    lines.push(
      `  ${bold(`${verb} ${plural(sites(report.fixed), 'site')}`)} in ${plural(report.changes.length, 'file')}`,
      '',
    );
    for (const summary of report.fixed) {
      lines.push(
        `      ${String(summary.sites).padStart(3)}  ${summary.title}  ${dim(summary.ruleId)}`,
      );
    }
    lines.push('');
  }

  const semantic = report.remaining.filter((finding) => finding.category === 'SEMANTIC');
  const manual = report.remaining.filter((finding) => finding.category === 'MECHANICAL');

  // The remaining work is re-printed, always. `apply` finishing quietly would
  // read as "the upgrade is done", which is the one wrong conclusion to leave.
  if (manual.length > 0) {
    lines.push(`  ${bold(`Left for you — mechanical (${manual.length})`)}`, '');
    lines.push(...ruleGroups(manual, options, false));
  }
  if (semantic.length > 0) {
    lines.push(`  ${bold(`Left for you — semantic (${semantic.length})`)}  ⚠`, '');
    lines.push(...ruleGroups(semantic, options, true));
  }

  if (report.dryRun) {
    lines.push(`  ${dim('Nothing was written. Drop --dry-run to apply.')}`, '');
  } else if (report.changes.length > 0) {
    lines.push(`  ${dim('Review the diff, then run your test suite before the next hop.')}`, '');
  }

  return lines.join('\n');
}

function plural(count: number, noun: string): string {
  return `${count.toLocaleString('en-US')} ${noun}${count === 1 ? '' : 's'}`;
}

function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => (line ? pad + line : line))
    .join('\n');
}
