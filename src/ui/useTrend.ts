import { UNITS, type Alert, type MeasurementKey } from "../contracts";
import {
  FIRST_SEED_DAY,
  MISSION_DAY_TODAY,
  missionDayStart,
  rollingBaselineSeries,
  store,
  useLive,
} from "../data/db";

/** Light-surface chart tokens from the Figma design system. */
export const CHART = {
  ink: "#0e1726",
  line: "#1f5eff",
  band: "#e8eeff",
  bandEdge: "#1f5eff",
  watch: "#f59e0b",
  watchSoft: "#fff3d6",
  act: "#e5383b",
  actSoft: "#fdecec",
  surface: "#ffffff",
  grid: "#e3e8ef",
  axis: "#98a2b3",
};

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TrendPoint {
  t: number;
  value: number;
  measurementId: string;
  mean?: number;
  std?: number;
  band?: [number, number];
  severity?: Alert["severity"];
  isCase?: boolean;
}

export interface Trend {
  key: MeasurementKey;
  unit: string;
  line: TrendPoint[];
  cases: TrendPoint[];
  from: number;
  to: number;
  ticks: number[];
  latest?: TrendPoint;
  /** Latest point that has a baseline, for μ and σ chips. */
  latestBaseline?: TrendPoint;
  ready: boolean;
}

export function fmt(v: number | undefined, digits = 1): string {
  return v === undefined ? "–" : Number.isInteger(v) ? String(v) : v.toFixed(digits);
}

/**
 * One metric over the mission week: readings, the rolling personal μ ± 2σ band, alert severities,
 * and emergency-test readings kept apart from the line.
 */
export function useTrend(crewId: string, key: MeasurementKey, days = MISSION_DAY_TODAY - FIRST_SEED_DAY + 1): Trend {
  const firstDay = MISSION_DAY_TODAY - days + 1;
  const from = missionDayStart(firstDay).getTime();
  const to = missionDayStart(MISSION_DAY_TODAY).getTime() + DAY_MS;

  const { data } = useLive(async () => {
    // Pull 7 extra days so the first plotted points have their own baseline window.
    const [rows, alerts] = await Promise.all([
      store.listMeasurements(crewId, new Date(from - 7 * DAY_MS).toISOString()),
      store.listAlerts(crewId),
    ]);
    return { rows: rows.filter((m) => m.key === key), alerts: alerts.filter((a) => a.key === key) };
  }, [crewId, key, from]);

  const sev = new Map((data?.alerts ?? []).filter((a) => a.measurementId).map((a) => [a.measurementId!, a.severity]));
  const line: TrendPoint[] = rollingBaselineSeries(data?.rows ?? [], key)
    .map((p) => ({
      t: Date.parse(p.takenAt),
      value: p.value,
      measurementId: p.measurementId,
      mean: p.mean,
      std: p.mean !== undefined && p.high !== undefined ? (p.high - p.mean) / 2 : undefined,
      band: p.low !== undefined && p.high !== undefined ? ([p.low, p.high] as [number, number]) : undefined,
      severity: sev.get(p.measurementId),
    }))
    .filter((p) => p.t >= from && p.t < to);
  const cases: TrendPoint[] = (data?.rows ?? [])
    .filter((m) => m.caseId)
    .map((m) => ({ t: Date.parse(m.takenAt), value: m.value, measurementId: m.id, severity: sev.get(m.id), isCase: true }))
    .filter((p) => p.t >= from && p.t < to);
  const ticks = Array.from({ length: days }, (_, i) => missionDayStart(firstDay + i).getTime() + DAY_MS / 2);

  return {
    key,
    unit: UNITS[key],
    line,
    cases,
    from,
    to,
    ticks,
    latest: line.at(-1),
    latestBaseline: [...line].reverse().find((p) => p.mean !== undefined),
    ready: data !== undefined,
  };
}

