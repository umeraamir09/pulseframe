import {
  KEY_LABELS,
  UNITS,
  type Alert,
  type Baseline,
  type Measurement,
  type MeasurementKey,
} from "../../contracts";

/** Keys shown on the current-info stage, in display order. */
export const CURRENT_INFO_KEYS = [
  "heartRate",
  "systolicBP",
  "diastolicBP",
  "temperatureC",
  "oxygenSat",
  "sleepHours",
] as const satisfies readonly MeasurementKey[];

export type CurrentInfoKey = (typeof CURRENT_INFO_KEYS)[number];

export interface CurrentInfoRow {
  key: CurrentInfoKey;
  label: string;
  unit: string;
  value?: number;
  takenAt?: string;
  mean?: number;
  std?: number;
}

export interface CurrentInfoSnapshot {
  at: string;
  rows: CurrentInfoRow[];
  openAlertIds: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Latest value in the last 24 hours, plus the stored personal baseline, plus open alert ids. */
export function buildCurrentInfo(
  measurements: readonly Measurement[],
  baselines: readonly Baseline[],
  alerts: readonly Alert[],
  now = new Date(),
): CurrentInfoSnapshot {
  const end = now.getTime();
  const from = end - DAY_MS;
  const rows: CurrentInfoRow[] = CURRENT_INFO_KEYS.map((key) => {
    const latest = measurements
      .filter((row) => row.key === key && Date.parse(row.takenAt) >= from && Date.parse(row.takenAt) <= end)
      .sort((a, b) => Date.parse(a.takenAt) - Date.parse(b.takenAt))
      .at(-1);
    const baseline = baselines.find((row) => row.key === key);
    return {
      key,
      label: KEY_LABELS[key],
      unit: UNITS[key],
      value: latest?.value,
      takenAt: latest?.takenAt,
      mean: baseline?.mean,
      std: baseline?.std,
    };
  });
  return {
    at: now.toISOString(),
    rows,
    openAlertIds: alerts.filter((alert) => !alert.ackedAt).map((alert) => alert.id),
  };
}
