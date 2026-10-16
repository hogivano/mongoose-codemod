/**
 * Unified diff for `--dry-run`.
 *
 * "Zero mutation without a diff the user can see" — so this is not a
 * nicety, it is the thing that makes `apply` reviewable before it runs.
 *
 * Written by hand rather than pulled in as a dependency: codemod edits are
 * small and local, so trimming the common prefix and suffix leaves a handful of
 * lines to align, and a whole diff library would be carried for that.
 */

import type { FileChange } from '../../domain/index.ts';

const tty = () => process.stdout.isTTY === true;
const green = (text: string) => (tty() ? `\u001b[32m${text}\u001b[0m` : text);
const red = (text: string) => (tty() ? `\u001b[31m${text}\u001b[0m` : text);
const dim = (text: string) => (tty() ? `\u001b[2m${text}\u001b[0m` : text);

/** Unchanged lines kept either side of a change, as context. */
const CONTEXT = 3;

/**
 * Above this many changed lines in one file, the alignment is not worth
 * computing — a codemod that rewrote this much is something to look at in git,
 * not in a terminal summary.
 */
const MAX_ALIGNED_LINES = 2000;

export function formatDiff(changes: readonly FileChange[]): string {
  return changes.map(fileDiff).join('\n');
}

function fileDiff(change: FileChange): string {
  const before = change.before.split('\n');
  const after = change.after.split('\n');
  const header = [dim(`--- a/${change.file}`), dim(`+++ b/${change.file}`)];
  return [...header, ...hunks(before, after), ''].join('\n');
}

function hunks(before: string[], after: string[]): string[] {
  // Identical top and bottom are the overwhelming majority of both files.
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;

  let end = 0;
  while (
    end < before.length - start &&
    end < after.length - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  ) {
    end++;
  }

  const beforeMiddle = before.slice(start, before.length - end);
  const afterMiddle = after.slice(start, after.length - end);

  const body =
    beforeMiddle.length > MAX_ALIGNED_LINES || afterMiddle.length > MAX_ALIGNED_LINES
      ? [...beforeMiddle.map((line) => red(`-${line}`)), ...afterMiddle.map((line) => green(`+${line}`))]
      : align(beforeMiddle, afterMiddle);

  const leadingFrom = Math.max(0, start - CONTEXT);
  const leading = before.slice(leadingFrom, start).map((line) => ` ${line}`);
  const trailing = before
    .slice(before.length - end, before.length - end + CONTEXT)
    .map((line) => ` ${line}`);

  // The header counts the context lines too, or it does not describe the hunk
  // that follows it.
  const context = leading.length + trailing.length;
  const position =
    `@@ -${leadingFrom + 1},${beforeMiddle.length + context}` +
    ` +${leadingFrom + 1},${afterMiddle.length + context} @@`;
  return [dim(position), ...leading, ...body, ...trailing];
}

/**
 * Longest common subsequence over lines, so an unchanged line inside the
 * changed region is shown as context rather than as a delete plus an add.
 */
function align(before: string[], after: string[]): string[] {
  const lengths: number[][] = Array.from({ length: before.length + 1 }, () =>
    new Array<number>(after.length + 1).fill(0),
  );

  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      lengths[i]![j] =
        before[i] === after[j]
          ? lengths[i + 1]![j + 1]! + 1
          : Math.max(lengths[i + 1]![j]!, lengths[i]![j + 1]!);
    }
  }

  const lines: string[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      lines.push(` ${before[i]}`);
      i++;
      j++;
    } else if (lengths[i + 1]![j]! >= lengths[i]![j + 1]!) {
      lines.push(red(`-${before[i]}`));
      i++;
    } else {
      lines.push(green(`+${after[j]}`));
      j++;
    }
  }
  while (i < before.length) lines.push(red(`-${before[i++]}`));
  while (j < after.length) lines.push(green(`+${after[j++]}`));
  return lines;
}
