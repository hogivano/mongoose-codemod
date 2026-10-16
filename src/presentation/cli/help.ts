/**
 * Help text.
 *
 * The taxonomy is stated here rather than buried in the README, because the
 * first question anyone has about a codemod is what it is willing to touch.
 */

import { createRuleRegistry } from '../../infrastructure/rules/registry.ts';

const tty = () => process.stdout.isTTY === true;
const bold = (text: string) => (tty() ? `[1m${text}[0m` : text);
const dim = (text: string) => (tty() ? `[2m${text}[0m` : text);

export function help(): string {
  const rules = createRuleRegistry().all();
  const mechanical = rules.filter((rule) => rule.meta.category === 'MECHANICAL').length;
  const semantic = rules.length - mechanical;

  return `${bold('mongoose-codemod')} — find what a Mongoose upgrade breaks, fix only what is safe to fix

${bold('USAGE')}
  mongoose-codemod [command] [path] [options]

  <path> is the directory to scan  ${dim('(default: the working directory)')}

${bold('COMMANDS')}
  scan    Report what would break. Read-only, and the default.
  apply   Rewrite the mechanical changes. One major version at a time.
  list    Show every rule and its category.

${bold('THE TWO CATEGORIES')}
  MECHANICAL  syntax changed, meaning did not      ${dim(`${mechanical} rules`)}
  SEMANTIC    runtime behaviour changed silently   ${dim(`${semantic} rules`)}

  \`apply\` transforms MECHANICAL sites and never touches a SEMANTIC one. Those
  are reported with their location and what to check, because a rewrite that
  might change behaviour is worse than no rewrite at all.

${bold('OPTIONS')}
  --from <major>     Version you are on     ${dim('(required, 5–9)')}
  --to <major>       Version you want       ${dim('(required, 5–9)')}
  --only <id,...>    Run only these rules   ${dim('(ids from `list`)')}
  --ignore <glob>    Skip paths. Repeatable.
  --all              List every site, not the first few per rule.
  --dry-run          apply only: print the diff, write nothing.
  --force            apply only: proceed with an unclean git tree.
  --json             Machine-readable output.
  -h, --help         Show this help.
  -v, --version      Print the version.

${bold('EXIT CODES')}
  0  nothing found
  1  findings pending  ${dim('— work to do, not a tool failure. Usable as a CI gate.')}
  2  error

${bold('EXAMPLES')}
  ${dim('# the common case: what does 5 → 7 cost me?')}
  mongoose-codemod scan --from 5 --to 7 ./src

  ${dim('# see the rewrite before it happens')}
  mongoose-codemod apply --from 5 --to 6 ./src --dry-run

  ${dim('# do it, one hop, then run your tests')}
  mongoose-codemod apply --from 5 --to 6 ./src

  ${dim('# every rule, and which ones can be automated')}
  mongoose-codemod list

${bold('WHY ONE HOP AT A TIME')}
  strictQuery defaults to true in 6 and back to false in 7. A tool that treats
  5 → 9 as one transformation gets that wrong. \`apply\` therefore refuses more
  than one major per run, so your test suite runs in between.

${dim('https://github.com/hogivano/mongoose-codemod')}`;
}
