import type { MeasurementKey } from "../contracts";

/**
 * Demonstration thresholds, not clinical limits. Replace only with researcher-supplied, cited values.
 * Self-report scales only. Comparisons are inclusive.
 */
export interface HardBound {
  watchLow?: number;
  actLow?: number;
  watchHigh?: number;
  actHigh?: number;
}

export const DEMO_HARD_BOUNDS: Partial<Record<MeasurementKey, HardBound>> = {
  moodScore: { watchLow: 2, actLow: 1 },
  sleepQuality: { watchLow: 2, actLow: 1 },
  stressScore: { watchHigh: 4, actHigh: 5 },
  teamStrain: { watchHigh: 4, actHigh: 5 },
  painScore: { watchHigh: 4, actHigh: 7 },
};
