/**
 * WorkingTreePort over the git CLI.
 *
 * Only one question is asked — "is it safe to overwrite files here?" — so this
 * shells out rather than taking a git library as a dependency. Not being a repo
 * counts as not clean: without version control there is no undo, which is
 * exactly the situation --force exists to acknowledge.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { WorkingTreePort } from '../../application/ports.ts';

const run = promisify(execFile);

export function createWorkingTree(root: string): WorkingTreePort {
  /** Modified tracked files, or null when this is not a git repository. */
  const dirtyFiles = async (): Promise<string[] | null> => {
    try {
      const { stdout } = await run('git', ['status', '--porcelain', '--untracked-files=no'], {
        cwd: root,
      });
      return stdout.split('\n').filter((line) => line.trim().length > 0);
    } catch {
      return null;
    }
  };

  return {
    async isClean(): Promise<boolean> {
      const dirty = await dirtyFiles();
      return dirty !== null && dirty.length === 0;
    },

    async describe(): Promise<string> {
      const dirty = await dirtyFiles();
      if (dirty === null) return `${root} is not a git repository`;
      if (dirty.length === 0) return 'working tree is clean';
      const count = dirty.length;
      return `${count} uncommitted ${count === 1 ? 'change' : 'changes'} in ${root}`;
    },
  };
}
