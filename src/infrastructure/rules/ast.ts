/**
 * Shared AST queries. Every rule is built from these, so a false positive gets
 * fixed once, here, rather than eighteen times.
 *
 * The recurring problem in a codemod like this one is over-matching: `.count()`
 * exists on arrays, `.update()` exists on half the ORMs ever written. Almost
 * every helper is therefore scoped to files that actually pull in Mongoose.
 */

import { Node, SyntaxKind } from 'ts-morph';
import type {
  CallExpression,
  ObjectLiteralExpression,
  PropertyAssignment,
  SourceFile,
} from 'ts-morph';

/** Imports do not change under a codemod, so the answer is stable per file. */
const mongooseFiles = new WeakMap<SourceFile, boolean>();

/**
 * True when the file imports or requires Mongoose.
 *
 * The cost of this gate is a missed finding in a file that receives a model as
 * a parameter; the cost of not having it is `.update()` on every plain object
 * in the repo. Under-reporting is recoverable, a noisy report is not.
 */
export function usesMongoose(file: SourceFile): boolean {
  const cached = mongooseFiles.get(file);
  if (cached !== undefined) return cached;

  const fromImport = file
    .getImportDeclarations()
    .some((declaration) => isMongooseSpecifier(declaration.getModuleSpecifierValue()));

  const fromRequire =
    !fromImport &&
    file.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
      if (call.getExpression().getText() !== 'require') return false;
      const [specifier] = call.getArguments();
      return Node.isStringLiteral(specifier) && isMongooseSpecifier(specifier.getLiteralValue());
    });

  const result = fromImport || fromRequire;
  mongooseFiles.set(file, result);
  return result;
}

function isMongooseSpecifier(specifier: string): boolean {
  return specifier === 'mongoose' || specifier.startsWith('mongoose/');
}

/** Every `x.name(...)` call in the file, for any of the given method names. */
export function methodCalls(file: SourceFile, names: readonly string[]): CallExpression[] {
  return file.getDescendantsOfKind(SyntaxKind.CallExpression).filter((call) => {
    const callee = call.getExpression();
    return Node.isPropertyAccessExpression(callee) && names.includes(callee.getName());
  });
}

/**
 * Where a called method is actually declared.
 *
 *   'mongoose'  resolved into the mongoose package — definitely Mongoose
 *   'other'     resolved somewhere else — lodash, Agenda, the TS lib, the
 *               user's own data-access layer. Definitely not Mongoose.
 *   'unknown'   no declaration to resolve: an `any`, an untyped import, a
 *               parameter with no annotation.
 *
 * `update`, `count`, `remove`, `exists`, `set` and `find` are ordinary method
 * names that everything has. On a real codebase, matching them by name alone
 * produced 494 rewrites of a data-access layer's own `userDb.update()`, plus
 * findings on `_.remove()` and `agenda_job.remove()`. The name is not evidence;
 * the declaration is.
 */
export type MethodOrigin = 'mongoose' | 'other' | 'unknown';

export function methodOrigin(call: CallExpression): MethodOrigin {
  const callee = call.getExpression();
  if (!Node.isPropertyAccessExpression(callee)) return 'unknown';

  let declarations;
  try {
    declarations = callee.getNameNode().getSymbol()?.getDeclarations();
  } catch {
    return 'unknown';
  }
  if (declarations === undefined || declarations.length === 0) return 'unknown';

  const paths = declarations.map((declaration) => declaration.getSourceFile().getFilePath());
  if (paths.some((path) => MONGOOSE_PACKAGE.test(path))) return 'mongoose';
  return 'other';
}

/** Matches a declaration file inside the mongoose package, on any platform. */
const MONGOOSE_PACKAGE = /[/\\]node_modules[/\\]mongoose[/\\]/;

/**
 * Strict: the method is definitely Mongoose's.
 *
 * The bar for rewriting code. An unresolved type is not good enough — a wrong
 * rewrite is not something the user can recover from by reading the report.
 */
export function callsMongoose(call: CallExpression): boolean {
  return methodOrigin(call) === 'mongoose';
}

/**
 * Permissive: the method is Mongoose's, or nothing says otherwise.
 *
 * The bar for *reporting*. Untyped code — `doc.set(...)` where doc is `any` —
 * is exactly where these bugs hide, so a rule that only reports must not
 * discard it. It still excludes anything that positively resolves elsewhere.
 */
export function mayCallMongoose(call: CallExpression): boolean {
  return methodOrigin(call) !== 'other';
}

/** The method name of `x.name(...)`, or undefined for any other callee shape. */
export function calleeName(call: CallExpression): string | undefined {
  const callee = call.getExpression();
  return Node.isPropertyAccessExpression(callee) ? callee.getName() : undefined;
}

/** The receiver of `x.name(...)` as source text — `Model`, `this`, `doc`, … */
export function receiverText(call: CallExpression): string | undefined {
  const callee = call.getExpression();
  return Node.isPropertyAccessExpression(callee) ? callee.getExpression().getText() : undefined;
}

/** Calls whose object-literal argument is a connection options bag. */
const CONNECT_CALLS = ['connect', 'createConnection', 'openUri'];

/**
 * Option names that exist only in a Mongoose/driver connection options object.
 * An object literal containing one of these is a connection options bag no
 * matter where it sits, which is how the rules find the very common shape:
 *
 *   const options = { useNewUrlParser: true, poolSize: 10 };
 *   await mongoose.connect(url, makeOptions());
 *
 * Scanning only the literals passed directly to connect() misses every codebase
 * that builds its options in a function — including, as it turns out, the one
 * this tool was written for.
 */
const SIGNATURE_OPTIONS = [
  'useNewUrlParser',
  'useUnifiedTopology',
  'useFindAndModify',
  'useCreateIndex',
  'reconnectTries',
  'reconnectInterval',
  'autoReconnect',
  'keepAliveInitialDelay',
];

/**
 * Named properties of the file's connection options objects.
 *
 * Deliberately not "the identifier `poolSize` anywhere": `poolSize` is a
 * plausible option name for any connection pool, and these rules rewrite. A
 * literal that neither reaches connect() directly nor carries a signature
 * option is left alone — an options bag assembled by `Object.assign` is a known
 * miss, and a missed finding beats renaming another library's option.
 */
export function connectionOptions(
  file: SourceFile,
  propertyNames: readonly string[],
): PropertyAssignment[] {
  const passedToConnect = methodCalls(file, CONNECT_CALLS)
    .flatMap((call) => call.getArguments())
    .filter((argument): argument is ObjectLiteralExpression =>
      Node.isObjectLiteralExpression(argument),
    );

  const bySignature = file
    .getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)
    .filter((object) => propertiesNamed(object, SIGNATURE_OPTIONS).length > 0);

  const found = new Set<PropertyAssignment>();
  for (const options of [...passedToConnect, ...bySignature]) {
    for (const property of propertiesNamed(options, propertyNames)) found.add(property);
  }
  return [...found];
}

/**
 * Every named property in the file, at any depth.
 *
 * Use this rather than walking object literals and calling `propertiesNamed` on
 * each: a nested literal is both an object of its own and a descendant of its
 * parent, so that walk reports every nested match twice.
 */
export function allPropertiesNamed(
  file: SourceFile,
  names: readonly string[],
): PropertyAssignment[] {
  return file
    .getDescendantsOfKind(SyntaxKind.PropertyAssignment)
    .filter((property) => names.includes(propertyName(property)));
}

/** Named properties of one object literal, including nested object literals. */
export function propertiesNamed(
  object: ObjectLiteralExpression,
  names: readonly string[],
): PropertyAssignment[] {
  return object
    .getDescendantsOfKind(SyntaxKind.PropertyAssignment)
    .filter((property) => names.includes(propertyName(property)));
}

/** The key of a property assignment, with quotes stripped. */
export function propertyName(property: PropertyAssignment): string {
  const name = property.getNameNode();
  return Node.isStringLiteral(name) ? name.getLiteralValue() : name.getText();
}

/**
 * True when the expression is a function that declares at least one parameter.
 *
 * This is the one place a rule asks the type checker anything, and it is the
 * reason this project uses ts-morph rather than jscodeshift. `default: ObjectId`
 * and `default: FieldType.STRING` are the same shape to the parser, and only the
 * type tells them apart. Naming conventions were tried first and were wrong
 * about roughly 95% of a real codebase's schema defaults.
 *
 * The parameter count matters as much as the callability. A function declaring
 * no parameters cannot observe an argument it is newly handed, so `Date.now` and
 * every `getDefaultFromEnv()` in a codebase are unaffected by the Mongoose 6
 * change and do not belong in the report.
 *
 * An unresolvable type has no call signatures and so reads as "not a function".
 * That direction is deliberate: a missed finding is recoverable, a report full
 * of noise is not.
 */
export function acceptsAnArgument(node: Node): boolean {
  try {
    return node
      .getType()
      .getCallSignatures()
      .some((signature) => signature.getParameters().length > 0);
  } catch {
    return false;
  }
}

/** The statement a node belongs to, for rules that delete a whole line. */
export function enclosingStatement(node: Node) {
  return node.getFirstAncestor(Node.isStatement);
}

/**
 * Edit a node's source range directly, without going through the printer.
 *
 * `replaceWithText` re-indents whatever it inserts, which silently reformats
 * any node spanning more than one line:
 *
 *   await mongoose.createConnection(uri, {        await mongoose.createConnection(uri, {
 *     maxPoolSize: n,                     ──▶           maxPoolSize: n,
 *   });                                                 }).asPromise();
 *
 * A codemod that reformats every site it touches is not reviewable, so any rule
 * whose target can be multi-line edits by position instead.
 *
 * The cost is that a text edit forgets every node in the file — see how
 * `apply` re-detects when that happens.
 */
export function replaceRange(node: Node, text: string): boolean {
  if (node.wasForgotten()) return false;
  node.getSourceFile().replaceText([node.getStart(), node.getEnd()], text);
  return true;
}

/** Insert immediately before a node, preserving surrounding formatting. */
export function insertBefore(node: Node, text: string): boolean {
  if (node.wasForgotten()) return false;
  node.getSourceFile().insertText(node.getStart(), text);
  return true;
}

/** Insert immediately after a node, preserving surrounding formatting. */
export function insertAfter(node: Node, text: string): boolean {
  if (node.wasForgotten()) return false;
  node.getSourceFile().insertText(node.getEnd(), text);
  return true;
}

/**
 * Remove a property from its object literal.
 * Returns false when the node has already been removed by an earlier rewrite —
 * two rules can legitimately target the same key.
 */
export function removeProperty(property: PropertyAssignment): boolean {
  if (property.wasForgotten()) return false;
  property.remove();
  return true;
}
