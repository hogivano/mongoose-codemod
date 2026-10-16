# Architecture

Clean architecture, four layers, dependencies pointing inward only.

```
presentation ──▶ application ──▶ domain
     │                ▲
     └──▶ infrastructure ┘
              (implements the ports the application declares)
```

Nothing in `domain/` imports from any other layer. Nothing in `application/`
imports `ts-morph` for I/O or touches a file system. `infrastructure/` is where
ts-morph and git actually live. `presentation/cli/cli.ts` is the composition
root — the only file that knows both a use case and an adapter.

## The layers

### `src/domain/` — the taxonomy

Pure. No dependencies, no I/O, no AST library. This is the part that is the
product:

| File | Holds |
|---|---|
| `hop.ts` | `Hop`, `hopsBetween()` — one major-version step, the unit everything is modelled in |
| `rule.ts` | `MECHANICAL` / `SEMANTIC`, the `auto` / `manual` / `never` fix policy, and the invariant |
| `finding.ts` | One matched call site, and its stable ordering |
| `report.ts` | `ScanReport`, `ApplyReport`, and the pure functions that summarise them |
| `exit-code.ts` | 0 clean · 1 pending · 2 error |
| `errors.ts` | The errors the CLI knows how to print, each with a hint |

### `src/application/` — use cases and ports

`ports.ts` declares what the use cases need from the world: `CodebasePort`,
`WorkingTreePort`, `RuleRegistryPort`, `ClockPort`. `rule.ts` declares the rule
contract. `use-cases/` holds `scan`, `apply` and `listRules`.

### `src/infrastructure/` — adapters and rules

`codebase/ts-morph-codebase.ts` and `git/exec-working-tree.ts` implement the
ports. `rules/` holds the rules themselves, one file per rule, grouped by hop,
assembled and validated by `rules/registry.ts`.

### `src/presentation/` — the CLI and the reports

`cli/args.ts` parses, `cli/help.ts` explains, `cli/cli.ts` wires. `report/`
renders: `human.ts`, `json.ts`, `diff.ts`.

## Three decisions worth knowing about

### 1. Ports abstract I/O, not the AST

Rules take a ts-morph `SourceFile` directly, and `application/` imports its
types. That is a deliberate exception to the usual rule about keeping the
application layer framework-free.

Wrapping AST nodes behind our own interface would mean reimplementing a worse
ts-morph, and every rule would then be written against the imitation rather than
against the thing that is documented. ts-morph is our vocabulary for source
code, the way `string` is. The seam that actually matters — where files come
from, whether the git tree is clean, what time it is — is the one behind ports.

### 2. Rules live in infrastructure

The *taxonomy* is domain. *Detection* is a technical detail bound to a
particular AST library, so the rules sit in `infrastructure/rules/`. Swapping
ts-morph would rewrite that directory and `codebase/`, and touch nothing else.

### 3. The invariant is enforced by types, then re-checked at runtime

A rule is built by one of three constructors, and only one of them accepts a
`transform`:

```ts
defineAutoFix({ …, transform })   // MECHANICAL, fix: 'auto'
defineManual({ … })               // MECHANICAL, fix: 'manual' — no transform
defineSemantic({ … })             // SEMANTIC,   fix: 'never'  — no transform
```

A `SemanticRule` has nowhere to put a transform, so `apply` cannot rewrite one
by mistake. `registry.ts` re-checks the same invariant when it builds, so a
rule that gets there another way fails on the first command rather than on
someone's production upgrade. `test/unit/registry.test.ts` asserts it a third
time against the real rule set.

### 4. Two bars for evidence, not one

`rules/ast.ts` resolves a called method to the file that declares it, and rules
choose how much certainty they need:

```ts
callsMongoose(call)     // resolved into node_modules/mongoose. Rewriting rules.
mayCallMongoose(call)   // that, or unresolvable. Reporting rules.
```

A rule that rewrites needs proof, because a wrong rewrite is not something the
reader can undo by disagreeing with the report. A rule that only reports can
accept uncertainty, because untyped code is where these bugs actually live.
This distinction maps exactly onto the MECHANICAL/SEMANTIC split, and it is why
`update()` is safe to auto-fix on a real codebase where hundreds of unrelated
objects also have an `update()` method.

## Two things that look redundant and are not

**`apply` scans twice.** The first scan is the report — what was true before
anything moved. The second runs after the rewrites and produces the remaining
work, because rewriting shifts every line below it: a leftover site described by
its pre-change position sends the reader to the wrong line of the file they now
have. Re-scanning also means "what is left" is measured rather than inferred.

**`ApplyReport.fixed` carries counts, not locations.** A site's line number
changes the moment another rule rewrites something above it, so a "fixed at
line 8" would point at neither the old file nor the new one. The before-state is
in `scan`, the after-state in `remaining`, and `fixed` is a tally between them.

## Editing source without reformatting it

`replaceWithText` runs the ts-morph printer, which re-indents whatever it
inserts. On a node spanning more than one line that silently reformats code the
rule never meant to touch:

```
  await mongoose.createConnection(uri, {          await mongoose.createConnection(uri, {
    maxPoolSize: n,                        ──▶          maxPoolSize: n,
  });                                                   }).asPromise();
```

A codemod whose diff is full of reindentation is not reviewable, and being
reviewable is the whole proposition. So a rule whose target can span lines edits
by position instead — `insertBefore`, `insertAfter`, `replaceRange` in
`rules/ast.ts`. Renaming a single identifier (`update` → `updateOne`) is always
one line and can keep using `replaceWithText`.

The cost is that a positional edit forgets every node in that file, including
matches still queued. `transformRuleInFile` in `use-cases/apply.ts` handles it:
when it finds a forgotten node it re-detects the rule against the current text
and resumes the same distance from the end. Declined sites collect at that tail
and are never retried, which is what makes the loop terminate.

## Adding a rule

1. Write `src/infrastructure/rules/hop-N-M/your-rule.ts` with one of the three
   constructors. Gate `detect` on `usesMongoose(file)` unless there is a reason
   not to.
2. Add it to that hop's `index.ts`, in report order.
3. For an auto-fix rule, add `test/fixtures/hop-N-M/your-rule.before.ts` and
   `.after.ts`. The fixture test picks it up by filename and runs the rule in
   isolation via `--only`.
4. If the rule can match something spanning several lines, give the fixture a
   multi-line case. Every fixture here was single-line once, which is exactly
   why the reindentation bug above reached a real codebase before a test.
5. `npm test`. The registry tests will reject a missing explanation, a missing
   docs link, a duplicate id, or a transform on a rule that should not have one.

Before writing detection, re-verify the change against the official migration
guide. The rules are the product; a wrong one misleads someone mid-upgrade.
