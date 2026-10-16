/** Errors the CLI knows how to print. Anything else is a bug and gets a stack. */

export class CodemodError extends Error {
  /** Extra lines printed under the message — say what to do, not just what broke. */
  readonly hint?: string;

  constructor(message: string, hint?: string) {
    super(message);
    this.name = new.target.name;
    if (hint !== undefined) this.hint = hint;
  }
}

/** Bad flags or arguments. */
export class UsageError extends CodemodError {}

/** `apply --from 5 --to 9`: refused on purpose. */
export class MultiHopApplyError extends CodemodError {}

/** Uncommitted changes and no --force: refused so the diff stays reviewable. */
export class DirtyWorkingTreeError extends CodemodError {}

/** Nothing to scan, or a root that does not exist. */
export class NoSourceFilesError extends CodemodError {}
