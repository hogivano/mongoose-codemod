/**
 * A hop is one major-version step, and it is the unit everything is modelled in.
 *
 * Why per-hop and not start→end: `strictQuery` flipped twice —
 * Mongoose 6 defaulted it to `true`, Mongoose 7 back to `false`. A tool that
 * models "5 → 9" as a single transformation reports that wrong. It also matches
 * how people actually upgrade: one major at a time, test suite green in between.
 */

/** Mongoose majors this tool knows how to talk about. */
export const MAJORS = [5, 6, 7, 8, 9] as const;

export type Major = (typeof MAJORS)[number];

export interface Hop {
  readonly from: Major;
  readonly to: Major;
}

/** Stable, machine-readable hop key. Used as an id in --json and in rule ids. */
export type HopId = `${number}->${number}`;

export function hopId(hop: Hop): HopId {
  return `${hop.from}->${hop.to}`;
}

/** Human form, for the report. */
export function formatHop(hop: Hop): string {
  return `${hop.from} → ${hop.to}`;
}

export function isMajor(value: number): value is Major {
  return (MAJORS as readonly number[]).includes(value);
}

/**
 * Expand an upgrade into the sequence of hops it is made of.
 * 5 → 8 becomes [5→6, 6→7, 7→8]. Throws for anything that is not an upgrade.
 */
export function hopsBetween(from: Major, to: Major): Hop[] {
  if (to <= from) {
    throw new RangeError(`mongoose-codemod only moves forward: ${from} → ${to} is not an upgrade`);
  }
  const hops: Hop[] = [];
  for (let major = from; major < to; major++) {
    // Every step is +1 and both ends are within MAJORS, so the cast is total.
    hops.push({ from: major as Major, to: (major + 1) as Major });
  }
  return hops;
}

export function isSingleHop(from: Major, to: Major): boolean {
  return to === from + 1;
}
