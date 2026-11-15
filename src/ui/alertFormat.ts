import { KEY_LABELS, UNITS, type Alert, type MeasurementKey } from "../contracts";
import { MISSION_DAY_TODAY, missionDayLabel, missionDayOf } from "../data/db";

export function fmtValue(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export const SCALE_KEYS: MeasurementKey[] = ["moodScore", "stressScore", "teamStrain", "sleepQuality"];

/** "Today, bpm" or "Last night, hours". */
export function caption(alert: Alert): string {
  const md = missionDayOf(alert.openedAt);
  const unit = UNITS[alert.key];
  if (alert.key === "sleepHours") return md === MISSION_DAY_TODAY ? "Last night, hours" : `${missionDayLabel(md)}, hours`;
  const day = md === MISSION_DAY_TODAY ? "Today" : missionDayLabel(md);
  if (SCALE_KEYS.includes(alert.key)) return `${KEY_LABELS[alert.key]}, rated`;
  return `${day}, ${unit}`;
}

/** One short line under the bar. */
export function shortLine(alert: Alert): string {
  if (alert.ruleId === "hard-bound") return `Rated ${KEY_LABELS[alert.key].toLowerCase()} is past the demo bound.`;
  const z = alert.zScore ?? 0;
  const label = alert.key === "sleepHours" ? "sleep" : KEY_LABELS[alert.key].toLowerCase();
  if (alert.severity === "act") return `Far ${z >= 0 ? "above" : "below"} your own 7-day baseline.`;
  return `${z >= 0 ? "Above" : "Below"} your usual ${label}.`;
}

