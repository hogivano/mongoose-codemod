import { performance } from 'node:perf_hooks';
import type { ClockPort } from '../application/ports.ts';

/** The real clock. Tests inject a fixed one so reports are byte-stable. */
export function createSystemClock(): ClockPort {
  return {
    now: () => new Date(),
    elapsedMs: () => performance.now(),
  };
}
