import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseArgs } from '../../src/presentation/cli/args.ts';
import { UsageError } from '../../src/domain/index.ts';

describe('argument parsing', () => {
  it('defaults to scan, the command that never writes', () => {
    assert.equal(parseArgs(['--from', '5', '--to', '6']).command, 'scan');
  });

  it('takes a path as the one positional argument', () => {
    const args = parseArgs(['scan', './src', '--from', '5', '--to', '6']);
    assert.equal(args.root, './src');
    assert.equal(args.command, 'scan');
  });

  it('defaults the path to the working directory', () => {
    assert.equal(parseArgs(['scan', '--from', '5', '--to', '6']).root, '.');
  });

  it('rejects an unknown flag instead of ignoring it', () => {
    assert.throws(() => parseArgs(['scan', '--dry-runn', '--from', '5', '--to', '6']), UsageError);
  });

  it('rejects a second positional argument', () => {
    assert.throws(() => parseArgs(['scan', './a', './b', '--from', '5', '--to', '6']), UsageError);
  });

  it('requires both --from and --to for scan and apply', () => {
    assert.throws(() => parseArgs(['scan', '--from', '5']), UsageError);
    assert.throws(() => parseArgs(['apply', '--to', '6']), UsageError);
  });

  it('does not require versions for list', () => {
    assert.equal(parseArgs(['list']).command, 'list');
  });

  it('rejects a downgrade', () => {
    assert.throws(() => parseArgs(['scan', '--from', '7', '--to', '5']), UsageError);
  });

  it('rejects a version outside the majors it knows', () => {
    assert.throws(() => parseArgs(['scan', '--from', '4', '--to', '6']), UsageError);
    assert.throws(() => parseArgs(['scan', '--from', '5', '--to', 'six']), UsageError);
  });

  it('rejects write flags on commands that never write', () => {
    assert.throws(() => parseArgs(['scan', '--from', '5', '--to', '6', '--dry-run']), UsageError);
    assert.throws(() => parseArgs(['list', '--force']), UsageError);
  });

  it('splits --only and accumulates --ignore', () => {
    const args = parseArgs([
      'scan', '--from', '5', '--to', '6',
      '--only', 'a, b ,c',
      '--ignore', '**/legacy/**',
      '--ignore', '**/vendor/**',
    ]);
    assert.deepEqual(args.only, ['a', 'b', 'c']);
    assert.deepEqual(args.ignore, ['**/legacy/**', '**/vendor/**']);
  });

  it('short-circuits validation for --help', () => {
    assert.equal(parseArgs(['apply', '--help']).help, true);
  });
});
