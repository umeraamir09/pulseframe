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
  "radiationRate",
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
  radiationRate: "µGy/h",
};

export const KEY_LABELS: Record<MeasurementKey, string> = {
  heartRate: "Heart rate",
  systolicBP: "Systolic BP",
  diastolicBP: "Diastolic BP",
  temperatureC: "Body temperature",
  bloodGlucose: "Blood glucose",
  sleepHours: "Sleep",
  moodScore: "Mood",
  stressScore: "Stress",
  teamStrain: "Team strain",
  sleepQuality: "Sleep quality",
  oxygenSat: "Oxygen saturation",
  painScore: "Pain",
  radiationRate: "Radiation dose rate",
};

export const HRP_HAZARDS = [
  { id: "radiation", label: "Space radiation" },
  { id: "isolation", label: "Isolation and confinement" },
  { id: "distance", label: "Distance from Earth" },
  { id: "gravity", label: "Gravity fields" },
  { id: "environment", label: "Hostile or closed environments" },
] as const;

export type HazardId = (typeof HRP_HAZARDS)[number]["id"];
export const HRP_HAZARDS_URL = "https://www.nasa.gov/hrp/hazards/";

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
