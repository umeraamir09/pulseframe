import { KEY_LABELS, UNITS } from "../contracts";
import type { Alert, AlertSeverity, Baseline, Measurement, MeasurementKey } from "../contracts";
import { DEMO_HARD_BOUNDS } from "./demoBounds";
import { missionDayOf } from "./mission";

/**
 * Personal-baseline anomaly engine. Pure functions only (no store access), so it can be unit tested.
 * Each new reading is compared with the same crew member's own previous 7 days:
 *   z = (x - μ) / σ, Watch at |z| ≥ 2, Act at |z| ≥ 3.
 * Before burn-in, or when σ is near zero, only the demonstration hard bounds apply.
 * This is not a NASA-validated diagnostic method.
 */
export const BASELINE_WINDOW_DAYS = 7;
export const BURN_IN_MIN_SAMPLES = 3;
export const BURN_IN_MIN_DAYS = 3;
export const Z_WATCH = 2;
export const Z_ACT = 3;
export const NEAR_ZERO_RATIO = 0.001;

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_MS = BASELINE_WINDOW_DAYS * DAY_MS;

export const SEVERITY_RANK: Record<AlertSeverity, number> = { watch: 1, act: 2 };

/** Same crew and key, no emergency-case rows, not the reading itself, takenAt in [x - 7d, x). */
export function baselineWindow(x: Measurement, history: Measurement[]): Measurement[] {
  const end = Date.parse(x.takenAt);
  const start = end - WINDOW_MS;
  return history.filter((m) => {
    if (m.crewId !== x.crewId || m.key !== x.key || m.caseId || m.id === x.id) return false;
    const t = Date.parse(m.takenAt);
    return t >= start && t < end;
  });
}

/** Mean and sample standard deviation (n - 1). */
export function computeStats(values: number[]): { mean: number; std: number; n: number } {
  const n = values.length;
  if (!n) return { mean: NaN, std: NaN, n };
  const mean = values.reduce((s, v) => s + v, 0) / n;
  if (n < 2) return { mean, std: 0, n };
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  return { mean, std: Math.sqrt(variance), n };
}

export interface WindowStats {
  mean: number;
  std: number;
  n: number;
  /** True when burn-in is met and σ is not near zero, so a z-score is meaningful. */
  usable: boolean;
}

export function windowStats(window: Measurement[]): WindowStats {
  const { mean, std, n } = computeStats(window.map((m) => m.value));
  const days = new Set(window.map((m) => missionDayOf(m.takenAt))).size;
  const burnedIn = n >= BURN_IN_MIN_SAMPLES && days >= BURN_IN_MIN_DAYS;
  const nearZero = !(std >= Math.max(1e-6, NEAR_ZERO_RATIO * Math.abs(mean)));
  return { mean, std, n, usable: burnedIn && !nearZero };
}

function hardBoundHit(key: MeasurementKey, value: number): { severity: AlertSeverity; bound: number } | undefined {
  const b = DEMO_HARD_BOUNDS[key];
  if (!b) return undefined;
  if (b.actLow !== undefined && value <= b.actLow) return { severity: "act", bound: b.actLow };
  if (b.actHigh !== undefined && value >= b.actHigh) return { severity: "act", bound: b.actHigh };
  if (b.watchLow !== undefined && value <= b.watchLow) return { severity: "watch", bound: b.watchLow };
  if (b.watchHigh !== undefined && value >= b.watchHigh) return { severity: "watch", bound: b.watchHigh };
  return undefined;
}

export type AlertDraft = Omit<Alert, "id">;

/** Scores one reading against its own baseline window. */
export function scoreMeasurement(x: Measurement, history: Measurement[]): { draft?: AlertDraft; baseline?: Baseline } {
  const window = baselineWindow(x, history);
  const stats = windowStats(window);
  const baseline: Baseline | undefined =
    stats.n > 0
      ? {
          crewId: x.crewId,
          key: x.key,
          windowDays: BASELINE_WINDOW_DAYS,
          mean: stats.mean,
          std: stats.std,
          updatedAt: x.takenAt,
        }
      : undefined;

  const common = {
    crewId: x.crewId,
    key: x.key,
    value: x.value,
    measurementId: x.id,
    caseId: x.caseId,
    openedAt: x.takenAt,
    windowDays: BASELINE_WINDOW_DAYS,
    sampleCount: stats.n,
  };

  if (stats.usable) {
    const zScore = (x.value - stats.mean) / stats.std;
    const abs = Math.abs(zScore);
    if (abs < Z_WATCH) return { baseline };
    const severity: AlertSeverity = abs >= Z_ACT ? "act" : "watch";
    const draft: AlertDraft = {
      ...common,
      severity,
      ruleId: severity === "act" ? "z-act" : "z-watch",
      zScore,
      mean: stats.mean,
      std: stats.std,
      message: "",
    };
    draft.message = explainAlert(draft);
    return { draft, baseline };
  }

  const hit = hardBoundHit(x.key, x.value);
  if (!hit) return { baseline };
  const draft: AlertDraft = {
    ...common,
    severity: hit.severity,
    ruleId: "hard-bound",
    mean: stats.n ? stats.mean : undefined,
    std: stats.n ? stats.std : undefined,
    message: "",
  };
  draft.message = explainAlert(draft);
  return { draft, baseline };
}

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
}

function withUnit(v: number | string, key: MeasurementKey): string {
  const u = UNITS[key];
  return u === "%" ? `${v}%` : `${v} ${u}`;
}

/** Plain-language explanation. Always ends with the not-a-diagnosis line. */
export function explainAlert(a: AlertDraft): string {
  const label = KEY_LABELS[a.key];
  let text: string;
  if ((a.ruleId === "z-watch" || a.ruleId === "z-act") && a.zScore !== undefined && a.mean !== undefined && a.std !== undefined) {
    const dir = a.zScore >= 0 ? "above" : "below";
    text =
      `${label} ${withUnit(fmt(a.value), a.key)} is ${Math.abs(a.zScore).toFixed(1)} standard deviations ${dir} ` +
      `your 7-day average of ${withUnit(a.mean.toFixed(1), a.key)} (spread ${a.std.toFixed(2)}). ` +
      (a.severity === "act"
        ? "Measure again now and follow the checklist or the emergency protocol."
        : "Keep an eye on it and measure again later.");
  } else {
    const hit = hardBoundHit(a.key, a.value);
    text = `${label} ${fmt(a.value)} reached the demonstration threshold of ${hit ? fmt(hit.bound) : "the demo bound"}.`;
  }
  return `${text} This compares you with your own recent baseline. It is not a diagnosis.`;
}

/**
 * Dedupe rule: one unacknowledged alert per crew, key and mission day. A higher severity replaces a lower one.
 * Returns which existing alert (if any) to replace, or `keep` when the draft should be dropped.
 */
export function dedupe(draft: AlertDraft, existing: Alert[]): { action: "add" } | { action: "replace"; old: Alert } | { action: "keep" } {
  const day = missionDayOf(draft.openedAt);
  const same = existing.find(
    (a) => !a.ackedAt && a.crewId === draft.crewId && a.key === draft.key && missionDayOf(a.openedAt) === day,
  );
  if (!same) return { action: "add" };
  return SEVERITY_RANK[draft.severity] > SEVERITY_RANK[same.severity] ? { action: "replace", old: same } : { action: "keep" };
}

export interface BaselinePoint {
  takenAt: string;
  value: number;
  measurementId: string;
  mean?: number;
  std?: number;
  low?: number;
  high?: number;
}

/** Per-reading rolling baseline for charts. `low`/`high` are μ ± 2σ, only once burn-in is met. Case rows excluded. */
export function rollingBaselineSeries(rows: Measurement[], key: MeasurementKey): BaselinePoint[] {
  const series = rows
    .filter((m) => m.key === key && !m.caseId)
    .sort((a, b) => Date.parse(a.takenAt) - Date.parse(b.takenAt));
  return series.map((m) => {
    const s = windowStats(baselineWindow(m, series));
    const p: BaselinePoint = { takenAt: m.takenAt, value: m.value, measurementId: m.id };
    if (s.usable) {
      p.mean = s.mean;
      p.std = s.std;
      p.low = s.mean - Z_WATCH * s.std;
      p.high = s.mean + Z_WATCH * s.std;
    }
    return p;
  });
}

/** Replays history in time order and returns the alerts and final baselines it would produce. Pure. */
export function replayAlerts(rows: Measurement[]): { alerts: AlertDraft[]; baselines: Baseline[] } {
  const sorted = [...rows].sort((a, b) => Date.parse(a.takenAt) - Date.parse(b.takenAt));
  const alerts: (AlertDraft & { _i: number })[] = [];
  const baselines = new Map<string, Baseline>();
  sorted.forEach((x, i) => {
    const { draft, baseline } = scoreMeasurement(x, sorted);
    if (baseline) baselines.set(`${x.crewId}:${x.key}`, baseline);
    if (!draft) return;
    const d = dedupe(draft, alerts.map((a) => ({ ...a, id: String(a._i) })));
    if (d.action === "add") alerts.push({ ...draft, _i: i });
    else if (d.action === "replace") alerts[alerts.findIndex((a) => String(a._i) === d.old.id)] = { ...draft, _i: i };
  });
  return { alerts: alerts.map(({ _i, ...a }) => a), baselines: [...baselines.values()] };
}
