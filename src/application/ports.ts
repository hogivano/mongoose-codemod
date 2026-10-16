/**
 * Ports: what the use cases need from the outside world, stated as interfaces.
 * Adapters live in src/infrastructure and are wired in src/presentation/cli.
 *
 * ── A deliberate exception ────────────────────────────────────────────────
 * These ports abstract the *project*: where files come from, whether the git
 * tree is clean, what time it is. They do NOT abstract the AST — rules take a
 * ts-morph `SourceFile` directly.
 *
 * That is on purpose. Wrapping AST nodes behind our own interface would mean
 * reimplementing a worse ts-morph, and every rule would be written against the
 * imitation instead of the thing that is actually documented. ts-morph is our
 * vocabulary for source code, the same way `string` is; the seam we care about
 * is I/O, and that seam is here.
 */

import type { SourceFile } from 'ts-morph';
import type { FileChange, Hop, HopId } from '../domain/index.ts';
import type { Rule } from './rule.ts';

/** The set of files under consideration, and the ability to write them back. */
export interface CodebasePort {
  /** Absolute path the scan was rooted at. */
  readonly root: string;
  /** Every file in scope, already parsed. */
  sourceFiles(): readonly SourceFile[];
  /** Root-relative path. Reports never print absolute paths. */
  relativePath(file: SourceFile): string;
  /**
   * Files whose text differs from what was read, as before/after pairs.
   * Drives both `--dry-run` diffs and the "did anything change" check.
   */
  pendingChanges(): FileChange[];
  /** Write pending changes to disk. Never called on `scan`. */
  save(): Promise<void>;
}

/** Just enough git to refuse to overwrite work the user has not committed. */
export interface WorkingTreePort {
  /** False when tracked files are modified, or when this is not a repo. */
  isClean(): Promise<boolean>;
  /** One line for the error message: "3 modified files" / "not a git repository". */
  describe(): Promise<string>;
}

export interface RuleRegistryPort {
  all(): readonly Rule[];
  /** Rules for one hop, in report order. Empty when the hop is not researched. */
  rulesFor(hop: Hop): readonly Rule[];
  /** Hops that actually have rules. Everything else is reported as a gap. */
  coveredHops(): readonly HopId[];
}

/** Injected so reports are deterministic under test. */
export interface ClockPort {
  now(): Date;
  /** Monotonic milliseconds, for durations. */
  elapsedMs(): number;
}
