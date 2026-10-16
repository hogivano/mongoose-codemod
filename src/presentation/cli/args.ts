/**
 * Argument parsing, kept apart from the wiring so it can be tested without
 * touching a file system.
 *
 * An unknown flag is an error, never ignored: the user asked for behaviour they
 * would not otherwise get, and silently dropping it is how a `--dry-run` typo
 * becomes an unwanted rewrite.
 */

import { isMajor, UsageError, type Major } from '../../domain/index.ts';

export type Command = 'scan' | 'apply' | 'list';

export interface ParsedArgs {
  command: Command;
  /** Directory to scan. Defaults to the working directory. */
  root: string;
  from?: Major;
  to?: Major;
  only?: string[];
  ignore?: string[];
  dryRun: boolean;
  force: boolean;
  json: boolean;
  /** List every site instead of the first few per rule. */
  all: boolean;
  help: boolean;
  version: boolean;
}

const COMMANDS: readonly string[] = ['scan', 'apply', 'list'];

export function parseArgs(argv: readonly string[]): ParsedArgs {
  // `scan` is the default posture: running the tool with no verb must
  // never be the one that writes.
  const first = argv[0];
  const hasCommand = first !== undefined && COMMANDS.includes(first);
  const rest = hasCommand ? argv.slice(1) : argv;

  const parsed: ParsedArgs = {
    command: (hasCommand ? first : 'scan') as Command,
    root: '.',
    dryRun: false,
    force: false,
    json: false,
    all: false,
    help: false,
    version: false,
  };

  let sawRoot = false;

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]!;

    const value = (): string => {
      const next = rest[++i];
      if (next === undefined || next.startsWith('-')) {
        throw new UsageError(`${arg} needs a value`);
      }
      return next;
    };

    const major = (raw: string): Major => {
      const parsedNumber = Number(raw);
      if (!Number.isInteger(parsedNumber) || !isMajor(parsedNumber)) {
        throw new UsageError(
          `${arg} expects a Mongoose major version between 5 and 9, got "${raw}"`,
        );
      }
      return parsedNumber;
    };

    switch (arg) {
      case '-h': case '--help': parsed.help = true; break;
      case '-v': case '--version': parsed.version = true; break;
      case '--json': parsed.json = true; break;
      case '--all': parsed.all = true; break;
      case '--dry-run': parsed.dryRun = true; break;
      case '--force': parsed.force = true; break;
      case '--from': parsed.from = major(value()); break;
      case '--to': parsed.to = major(value()); break;
      case '--only': parsed.only = splitList(value()); break;
      case '--ignore': parsed.ignore = [...(parsed.ignore ?? []), value()]; break;
      default: {
        if (arg.startsWith('-')) throw new UsageError(`unknown option ${arg}`);
        if (sawRoot) throw new UsageError(`unexpected argument "${arg}"`);
        parsed.root = arg;
        sawRoot = true;
      }
    }
  }

  validate(parsed);
  return parsed;
}

function validate(parsed: ParsedArgs): void {
  if (parsed.help || parsed.version) return;

  if (parsed.command !== 'list') {
    if (parsed.from === undefined || parsed.to === undefined) {
      throw new UsageError(
        'both --from and --to are required',
        'e.g. mongoose-codemod scan --from 5 --to 7 ./src',
      );
    }
    if (parsed.to <= parsed.from) {
      throw new UsageError(
        `--from ${parsed.from} --to ${parsed.to} is not an upgrade`,
        'mongoose-codemod only moves forward, one major at a time.',
      );
    }
  }

  if (parsed.command !== 'apply' && (parsed.dryRun || parsed.force)) {
    throw new UsageError(
      `--dry-run and --force only apply to \`apply\`; \`${parsed.command}\` never writes`,
    );
  }
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
