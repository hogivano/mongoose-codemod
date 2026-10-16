# mongoose-codemod

> Upgrading Mongoose breaks things in two ways: syntax that no longer compiles,
> and behaviour that silently changed. The first is tedious. The second is what
> actually bites you in production.
>
> `mongoose-codemod` fixes the first and refuses to touch the second — it tells
> you exactly where to look instead.

```
npx mongoose-codemod scan --from 5 --to 7 ./src
```

## The two categories

|  | Definition | What the tool does |
|---|---|---|
| **MECHANICAL** | Syntax changed; meaning did not | Transforms it |
| **SEMANTIC** | Runtime behaviour changed silently | **Never transforms it.** Reports the location and what to check. |

Anyone can grep for `.count(`. Knowing which changes silently alter what your
code does is the expertise, and it is the reason upgrades stall.

A codemod that refuses to touch ambiguous cases and explains why is more
trustworthy than one that tries. The refusal is the feature.

## What a scan looks like

```
mongoose-codemod scan  5 → 7  ./src

  2 files · 10 affected call sites in 2 files

  5 → 6

    MECHANICAL (5) — `apply` will fix these

      3  removed connect() options
         connect-options-removed
           src/db.ts:5:5  (useNewUrlParser is now the only behaviour)
             useNewUrlParser: true,

      1  execPopulate() removed
         exec-populate-removed
           src/user.ts:13:9
             await doc.populate('friends').execPopulate();

    SEMANTIC (4) — human review required  ⚠

      1  doc.set() with nested paths overwrites instead of merging
         nested-set-overwrites

           SILENT DATA LOSS if any of these relied on the merge.

           Mongoose 5:  doc.set({ child: { age: 21 } })  kept child.name
           Mongoose 6:  the same call replaces child entirely — child.name is gone,
                        and save() writes that away.

           Check each site. If it meant to merge, set the leaf path instead:
             doc.set('child.age', 21)

           src/user.ts:12:3  (nested path in this set())
             doc.set({ profile: { seenAt: new Date() } });
```

## Commands

```
mongoose-codemod scan  --from 5 --to 7 ./src   report only, read-only, the default
mongoose-codemod apply --from 5 --to 6 ./src   transform MECHANICAL only, one hop
mongoose-codemod list                          every rule and its category
```

| Flag | |
|---|---|
| `--from` / `--to` | Mongoose majors, 5–9. Required for `scan` and `apply`. |
| `--only <id,…>` | Run only these rules. Ids come from `list`. |
| `--ignore <glob>` | Skip paths. Repeatable. |
| `--all` | List every site, not the first few per rule. |
| `--dry-run` | `apply` only: print the diff, write nothing. |
| `--force` | `apply` only: proceed with an unclean git tree. |
| `--json` | Machine-readable output. |

Exit `0` clean, `1` findings pending, `2` error. `1` means there is work to do,
not that the tool failed — which is what makes `scan` usable as a CI gate
against upgrade drift.

## Three refusals

**`apply` moves one major at a time.** `--from 5 --to 9` is rejected with an
explanation. You want your test suite green between hops.

**`apply` will not rewrite an unclean git tree** without `--force`, so the
codemod diff stays reviewable on its own.

**`apply` never touches a SEMANTIC finding.** It re-prints them afterwards as
the remaining work, with their post-rewrite locations.

## Why per-hop and not 5 → 9 in one pass

`strictQuery` flipped twice. Mongoose 6 made it `true` by default — query
filters on paths not in your schema are silently dropped. Mongoose 7 made it
`false` again.

A tool that models "5 → 9" as one transformation reports that wrong for anyone
stopping at 6. Each hop is its own rule set, run and reported in sequence, which
is also how people actually upgrade.

## Validated on a real codebase

Run against a 27,736-file TypeScript monorepo on Mongoose 5.13 — the repo this
was written for. The first run reported **2,150 findings; 24 were real.** Every
false positive it exposed is now a rule fix and a regression test:

| What matched | Why it was wrong | Fix |
|---|---|---|
| 1,805 `.toString()` calls | `RENAMED['toString']` found `Object.prototype.toString`, so the lookup was never `undefined` | `Map`, not an object literal |
| 494 `userDb.update()` | The codebase's own data-access layer. **These would have been rewritten.** | Resolve the method to its declaring package |
| 323 `default: Status.Active` | Enum members are the same shape as a function reference to the parser | Ask the type checker for call signatures |
| 6 `_.find(list, (e) => …)` | lodash. `e` is an element, not an error | Dropped `e` from the error-first heuristic |
| `default: Date.now` | Declares no parameters, so it cannot see the new argument | Require a declared parameter |

The one that matters most is the second: a name-matching codemod would have
silently renamed 494 calls on an unrelated object. Rules that rewrite now
require the method to resolve into the `mongoose` package; rules that only
report accept "unresolved" too, since untyped `doc.set(…)` is exactly where
these bugs live.

It also exposed a false *negative*: the production connection options were
built inside a function rather than passed inline to `connect()`, so the four
real `useNewUrlParser`-family findings were missed while 14 spec-file ones were
reported. An object literal carrying a driver-only option key is now treated as
a connection options bag wherever it sits.

Type resolution costs real time — that scan takes ~2 minutes rather than ~40
seconds without it. For a once-per-major upgrade, being right is worth it.

## Rule coverage

| Hop | Rules | |
|---|---|---|
| 5 → 6 | 14 | 6 auto · 2 manual · 6 semantic |
| 6 → 7 | 9 | 5 auto · 2 manual · 2 semantic |
| 7 → 8 | — | not yet researched |
| 8 → 9 | — | not yet researched |

`scan` reports an unresearched hop as a gap, not as clean. Silence about a
version nobody has checked would be a lie.

Some mechanical changes are reported rather than rewritten, and say so:
`remove()` maps to `deleteMany()` on a model but `deleteOne()` on a document,
and without type information guessing would delete a collection instead of a
document.

## As a library

```ts
import {
  scan, apply,
  createCodebase, createRuleRegistry, createSystemClock, createWorkingTree,
} from 'mongoose-codemod';

const codebase = createCodebase({ root: './src' });
const report = scan(
  { codebase, registry: createRuleRegistry(), clock: createSystemClock() },
  { from: 5, to: 6 },
);
```

## Development

```
npm run typecheck
npm test          # 48 tests: fixture-driven per rule, plus the invariants
npm run build
npm run dev -- scan --from 5 --to 6 ./src
```

Every auto-fix rule has a `before.ts` / `after.ts` fixture and is run in
isolation, so a failure names one rule. If a SEMANTIC rule ever produces a
transformation, that is a test failure.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the layout and for how to add a
rule.

## Status

v0.1.0. Rules for 5 → 6 and 6 → 7. Not yet published to npm.

Known noise: report-only rules keep matches whose type cannot be resolved, so
an untyped `job.remove()` from another library can still appear. That is the
deliberate direction of the trade — see the table above.

Not yet implemented, in rough priority order: the callback → `await` transform
(currently reported, not rewritten — it is the biggest change in 6 → 7), the
7 → 8 and 8 → 9 rule sets, and the 5 → 6 rules that need dataflow analysis
(query reuse needing `Query#clone()`, `typePojoToMixed`, populate without a
`ref`).

MIT.
