import type { SeedProfile } from "./seed";

/**
 * The practice week the guide demo runs on. It replaces every store while the demo runs and is
 * wiped when it ends (see demoSession.ts). MD 136 to MD 141 are filled; on MD 142 (today) the
 * morning heart rate and blood pressure, the dosimeter and the psych check-in are left open so the
 * guide can type them in front of the crew.
 *
 * Values sit on published in-flight numbers (research/baselines-inflight.csv, research/radiation.csv):
 * - Heart rate: ISS 24 h mean 63 to 64 bpm (PMC4324706). Mean of this series is 63.3.
 * - Blood pressure: ISS 24 h mean 121/76 mmHg (PMC4324706).
 * - SpO2: about 97% in flight (PubMed, STS-69 and STS-72).
 * - Dose rate: ISS GCR about 6.0 to 6.3 µGy/h, about 145 to 151 µGy/day (DOSIS 3D, swsc160046).
 * Sleep, temperature, glucose and the psych scores are simulated and stay inside a normal band.
 */
const DAYS_BEFORE_TODAY = 6;

/** Six values for MD 136 to MD 141, nothing for today. */
function week(values: number[]): (number | undefined)[] {
  if (values.length !== DAYS_BEFORE_TODAY) throw new Error("A demo series needs six values.");
  return [...values, undefined];
}

/** Six values for MD 136 to MD 141 plus today's, for readings that are already logged this morning. */
function weekAndToday(values: number[]): number[] {
  if (values.length !== DAYS_BEFORE_TODAY + 1) throw new Error("A demo series needs seven values.");
  return values;
}

export const DEMO_SERIES: SeedProfile["series"] = {
  heartRate: week([60, 66, 62, 61, 67, 64]),
  systolicBP: week([118, 124, 121, 123, 119, 122]),
  diastolicBP: week([74, 78, 76, 77, 74, 77]),
  temperatureC: weekAndToday([36.6, 36.7, 36.5, 36.6, 36.7, 36.6, 36.6]),
  oxygenSat: weekAndToday([97, 98, 96, 97, 98, 97, 97]),
  bloodGlucose: weekAndToday([92, 95, 90, 94, 93, 91, 93]),
  sleepHours: weekAndToday([7.1, 6.9, 7.3, 7.0, 7.2, 6.9, 7.0]),
  sleepQuality: week([4, 3, 4, 4, 4, 3]),
  moodScore: week([3, 4, 5, 4, 4, 4]),
  stressScore: week([2, 2, 3, 2, 2, 2]),
  teamStrain: week([2, 2, 2, 1, 2, 2]),
  radiationRate: week([6.1, 6.4, 6.2, 6.3, 6.4, 6.3]),
};

export const DEMO_SEED_PROFILE: SeedProfile = {
  series: DEMO_SERIES,
  todayDone: new Set(["temperature", "oxygen-sat", "blood-glucose", "sleep", "vitamin-d", "scheduled-med", "resistive"]),
  pastOptionalDone: new Set(["blood-glucose", "hydration"]),
  aerobicSkipped: new Set(),
  todayRoutineDone: false,
};
