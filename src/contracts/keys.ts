/** Shared measurement keys. Dev B persists these; Dev A writes some of them from emergency tests. */
export const MEASUREMENT_KEYS = [
  "heartRate",
  "systolicBP",
  "diastolicBP",
  "temperatureC",
  "bloodGlucose",
  "sleepHours",
  "moodScore",
  "stressScore",
  "teamStrain",
  "sleepQuality",
  "oxygenSat",
  "painScore",
] as const;

export type MeasurementKey = (typeof MEASUREMENT_KEYS)[number];

export const UNITS: Record<MeasurementKey, string> = {
  heartRate: "bpm",
  systolicBP: "mmHg",
  diastolicBP: "mmHg",
  temperatureC: "°C",
  bloodGlucose: "mg/dL",
  sleepHours: "h",
  moodScore: "1-5",
  stressScore: "1-5",
  teamStrain: "1-5",
  sleepQuality: "1-5",
  oxygenSat: "%",
  painScore: "0-10",
};

export const SKELETON_REGIONS = [
  "head",
  "chest",
  "abdomen",
  "spine",
  "leftArm",
  "rightArm",
  "leftLeg",
  "rightLeg",
  "skin",
] as const;

export type SkeletonRegionId = (typeof SKELETON_REGIONS)[number];
