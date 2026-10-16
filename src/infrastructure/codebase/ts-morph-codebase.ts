/**
 * CodebasePort over ts-morph.
 *
 * ts-morph, not jscodeshift: the target codebases are TypeScript, and
 * the type-level rules — `LeanDocument`, `extends Document`, `HydratedDocument`
 * generics — need real type awareness. jscodeshift is the convention in codemod
 * land but is weaker here.
 */

import { relative, resolve } from 'node:path';
import { Project, type SourceFile } from 'ts-morph';
import type { FileChange } from '../../domain/index.ts';
import { NoSourceFilesError } from '../../domain/index.ts';
import type { CodebasePort } from '../../application/ports.ts';

/** Everything a Mongoose call could plausibly live in. */
const SOURCE_GLOBS = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts', '**/*.js', '**/*.mjs', '**/*.cjs'];

/**
 * Never scanned. Generated output and vendored code produce findings nobody
 * can act on, and `node_modules` alone would dominate every report.
 */
const IGNORED = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/coverage/**',
  '**/.git/**',
  '**/*.d.ts',
];

export interface CodebaseOptions {
  /** Directory to scan. */
  root: string;
  /** Extra ignore globs, from --ignore. */
  ignore?: readonly string[];
}

export function createCodebase(options: CodebaseOptions): CodebasePort {
  const root = resolve(options.root);

  const project = new Project({
    // No tsconfig lookup: we scan whatever is on disk, including repos whose
    // tsconfig excludes tests or scripts. Those files still call Mongoose.
    skipAddingFilesFromTsConfig: true,
    // Dependency resolution stays ON. It is what lets the type checker answer
    // where a method is declared and whether a default is callable — see
    // methodOrigin and acceptsAnArgument in rules/ast.ts. It pulls
    // declaration files into the ts-morph project, but `sourceFiles()` below
    // returns only the files this scan matched, so nothing in node_modules is
    // ever scanned or rewritten.
    compilerOptions: { allowJs: true },
  });

  const patterns = [
    ...SOURCE_GLOBS.map((glob) => `${root}/${glob}`),
    ...[...IGNORED, ...(options.ignore ?? [])].map((glob) => `!${glob}`),
  ];
  const files = project.addSourceFilesAtPaths(patterns);

  if (files.length === 0) {
    throw new NoSourceFilesError(
      `no JavaScript or TypeScript files under ${root}`,
      'Point mongoose-codemod at the directory that contains your source, e.g. `mongoose-codemod scan ./src`.',
    );
  }

  // The text as read. `pendingChanges` diffs against this, which is also what
  // makes a no-op `apply` genuinely write nothing.
  const original = new Map<string, string>(
    files.map((file) => [file.getFilePath(), file.getFullText()]),
  );

  return {
    root,

    sourceFiles: () => files,

    relativePath: (file: SourceFile) => relative(root, file.getFilePath()) || file.getBaseName(),

    pendingChanges(): FileChange[] {
      const changes: FileChange[] = [];
      for (const file of files) {
        const before = original.get(file.getFilePath());
        const after = file.getFullText();
        if (before !== undefined && before !== after) {
          changes.push({ file: relative(root, file.getFilePath()), before, after });
        }
      }
      return changes;
    },

    async save(): Promise<void> {
      await project.save();
    },
  };
}
