#!/usr/bin/env node
/**
 * The composition root: the only file that knows both a use case and an
 * adapter. Everything below it is wired by hand, which is why swapping the
 * ts-morph adapter or the git adapter is a change to this file alone.
 */

import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { apply, listRules, scan } from '../../application/index.ts';
import { CodemodError, EXIT, exitCodeFor, type ExitCode } from '../../domain/index.ts';
import { createCodebase } from '../../infrastructure/codebase/ts-morph-codebase.ts';
import { createWorkingTree } from '../../infrastructure/git/exec-working-tree.ts';
import { createRuleRegistry } from '../../infrastructure/rules/registry.ts';
import { createSystemClock } from '../../infrastructure/system-clock.ts';
import { formatDiff } from '../report/diff.ts';
import { applyToJson, scanToJson } from '../report/json.ts';
import { formatApply, formatScan } from '../report/human.ts';
import { parseArgs, type ParsedArgs } from './args.ts';
import { help } from './help.ts';

const dim = (text: string) => (process.stdout.isTTY === true ? `\u001b[2m${text}\u001b[0m` : text);

export async function main(argv: readonly string[]): Promise<ExitCode> {
  let args: ParsedArgs;
  try {
    args = parseArgs(argv);
  } catch (error) {
    return fail(error);
  }

  if (args.help) {
    console.log(help());
    return EXIT.CLEAN;
  }
  if (args.version) {
    console.log(version());
    return EXIT.CLEAN;
  }

  try {
    return await run(args);
  } catch (error) {
    return fail(error);
  }
}

async function run(args: ParsedArgs): Promise<ExitCode> {
  const registry = createRuleRegistry();

  if (args.command === 'list') {
    console.log(args.json ? listAsJson(registry, args) : listAsText(registry, args));
    return EXIT.CLEAN;
  }

  // Guaranteed by parseArgs for scan and apply.
  const from = args.from!;
  const to = args.to!;

  const codebase = createCodebase({
    root: args.root,
    ...(args.ignore === undefined ? {} : { ignore: args.ignore }),
  });
  const deps = { codebase, registry, clock: createSystemClock() };
  const format = { registry, ...(args.all ? { maxSites: Number.MAX_SAFE_INTEGER } : {}) };

  if (args.command === 'scan') {
    const report = scan(deps, { from, to, ...(args.only ? { only: args.only } : {}) });
    console.log(args.json ? scanToJson(report) : formatScan(report, format));
    return exitCodeFor(report);
  }

  const report = await apply(
    { ...deps, workingTree: createWorkingTree(codebase.root) },
    {
      from,
      to,
      dryRun: args.dryRun,
      force: args.force,
      ...(args.only ? { only: args.only } : {}),
    },
  );

  if (args.json) {
    console.log(applyToJson(report));
  } else {
    if (report.dryRun && report.changes.length > 0) console.log(formatDiff(report.changes));
    console.log(formatApply(report, format));
  }

  // Remaining work is pending work, even when every automatic fix succeeded.
  return report.remaining.length > 0 ? EXIT.PENDING : EXIT.CLEAN;
}

function listAsText(registry: ReturnType<typeof createRuleRegistry>, args: ParsedArgs): string {
  const request = args.from !== undefined && args.to !== undefined
    ? { from: args.from, to: args.to }
    : {};
  const lines: string[] = [''];

  for (const hop of listRules(registry, request)) {
    lines.push(`  ${hop.label}`);
    if (hop.rules.length === 0) {
      lines.push(`    ${dim('no rules yet — not researched')}`, '');
      continue;
    }
    const width = Math.max(...hop.rules.map((rule) => rule.id.length));
    for (const rule of hop.rules) {
      const tag = rule.category === 'SEMANTIC' ? 'SEMANTIC ⚠' : `MECHANICAL/${rule.fix}`;
      lines.push(`    ${rule.id.padEnd(width)}  ${dim(tag.padEnd(18))}  ${rule.title}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function listAsJson(registry: ReturnType<typeof createRuleRegistry>, args: ParsedArgs): string {
  const request = args.from !== undefined && args.to !== undefined
    ? { from: args.from, to: args.to }
    : {};
  const hops = listRules(registry, request).map((hop) => ({
    hop: hop.hopId,
    label: hop.label,
    rules: hop.rules.map((rule) => ({
      id: rule.id,
      category: rule.category,
      fix: rule.fix,
      title: rule.title,
      explain: rule.explain,
      ...(rule.docs === undefined ? {} : { docs: rule.docs }),
    })),
  }));
  return `${JSON.stringify({ version: 1, hops }, null, 2)}\n`;
}

/**
 * A CodemodError is a decision the tool made on purpose, so it prints as a
 * message and a hint. Anything else is a bug and keeps its stack.
 */
function fail(error: unknown): ExitCode {
  if (error instanceof CodemodError) {
    console.error(`mongoose-codemod: ${error.message}`);
    if (error.hint) console.error(`\n${error.hint}`);
  } else {
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  }
  return EXIT.ERROR;
}

function version(): string {
  try {
    const path = new URL('../../../package.json', import.meta.url);
    return (JSON.parse(readFileSync(path, 'utf8')) as { version: string }).version;
  } catch {
    return 'unknown';
  }
}

// Only run when invoked as a binary; importing this module must not exit.
if (isEntryPoint()) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = EXIT.ERROR;
    },
  );
}

function isEntryPoint(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return realpathSync(entry) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}
