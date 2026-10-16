/**
 * A CodebasePort backed by ts-morph's in-memory file system.
 *
 * Rule tests must not touch the disk: a codemod test that writes files is one
 * bad path away from rewriting the repo it is running in.
 */

import { Project, type SourceFile } from 'ts-morph';
import type { CodebasePort } from '../../src/application/ports.ts';
import type { ClockPort } from '../../src/application/ports.ts';
import type { FileChange } from '../../src/domain/index.ts';

export interface InMemoryCodebase extends CodebasePort {
  /** Current text of a file, after any transforms. */
  textOf(path: string): string;
  /** True once save() has been called — asserts that scan never writes. */
  saved(): boolean;
}

/**
 * Just enough of Mongoose's type declarations for the rules that ask the type
 * checker where a method is declared (`callsMongoose` in rules/ast.ts).
 *
 * Without this every `User.count()` in a fixture resolves to nothing, the
 * strict rules correctly decline to rewrite it, and the fixture tests pass or
 * fail for reasons that have nothing to do with the rule under test. The path
 * matters as much as the content: the check looks for a declaration inside
 * `node_modules/mongoose`.
 */
const MONGOOSE_STUB = `
export declare class Document {
  set(path: any, value?: any): this;
  populate(path: any): Promise<this>;
  remove(): Promise<this>;
  save(): Promise<this>;
}
export declare class Model<T = any> {
  static find(filter?: any, callback?: any): any;
  static findById(id?: any, callback?: any): any;
  static count(filter?: any, callback?: any): Promise<number>;
  static countDocuments(filter?: any, callback?: any): Promise<number>;
  static update(filter?: any, update?: any, options?: any, callback?: any): Promise<any>;
  static updateOne(filter?: any, update?: any, options?: any): Promise<any>;
  static updateMany(filter?: any, update?: any, options?: any): Promise<any>;
  static remove(filter?: any): Promise<any>;
  static deleteOne(filter?: any): Promise<any>;
  static exists(filter?: any): Promise<any>;
  static mapReduce(options?: any): Promise<any>;
}
export declare function model(name: string, schema?: any): typeof Model;
export declare class Schema { constructor(definition?: any, options?: any); }
declare const mongoose: {
  model: typeof model;
  Schema: typeof Schema;
  connect(uri?: any, options?: any): Promise<any>;
  createConnection(uri?: any, options?: any): any;
  set(key: string, value?: any): void;
  Types: { ObjectId: any };
  Promise: any;
};
export default mongoose;
`;

export function inMemoryCodebase(files: Record<string, string>): InMemoryCodebase {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { allowJs: true },
  });

  project.createSourceFile('/node_modules/mongoose/index.d.ts', MONGOOSE_STUB);
  project
    .getFileSystem()
    .writeFileSync('/node_modules/mongoose/package.json', '{"name":"mongoose","types":"index.d.ts"}');

  // Only the caller's files are returned by sourceFiles(), so the stub is
  // available to the type checker but never scanned or rewritten.
  const sourceFiles: SourceFile[] = Object.entries(files).map(([path, text]) =>
    project.createSourceFile(`/${path}`, text),
  );
  const original = new Map(Object.entries(files).map(([path, text]) => [`/${path}`, text]));
  let didSave = false;

  return {
    root: '/',
    sourceFiles: () => sourceFiles,
    relativePath: (file) => file.getFilePath().replace(/^\//, ''),

    pendingChanges(): FileChange[] {
      return sourceFiles
        .filter((file) => original.get(file.getFilePath()) !== file.getFullText())
        .map((file) => ({
          file: file.getFilePath().replace(/^\//, ''),
          before: original.get(file.getFilePath()) ?? '',
          after: file.getFullText(),
        }));
    },

    async save() {
      didSave = true;
    },

    textOf: (path) => project.getSourceFileOrThrow(`/${path}`).getFullText(),
    saved: () => didSave,
  };
}

/** A clock that does not move, so durations in reports are 0 and comparable. */
export function fixedClock(iso = '2026-01-01T00:00:00.000Z'): ClockPort {
  return { now: () => new Date(iso), elapsedMs: () => 0 };
}

/** A working tree that is whatever the test says it is. */
export function stubWorkingTree(clean: boolean) {
  return {
    isClean: async () => clean,
    describe: async () => (clean ? 'working tree is clean' : '2 uncommitted changes'),
  };
}
