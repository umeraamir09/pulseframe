/**
 * The small numeric summary the dashboard AI brief sends to POST /api/brief
 * (issue 30, step 7). Shared by the client (builds it) and the server (validates it).
 *
 * Only aggregates leave the device: counts, means, last values and the
 * personal baseline per key. Never a raw row, id, timestamp, note or name.
 */
import { z } from "zod";
import { MEASUREMENT_KEYS, type MeasurementKey } from "../../contracts/keys.ts";
import type { Alert, Baseline, ChecklistItem, Measurement, RadiationReading } from "../../contracts/types.ts";

const num = z.number().finite();

export const BriefMetricSchema = z
  .object({
    key: z.enum(MEASUREMENT_KEYS),
    /** Readings this week (case readings excluded). */
    n: z.number().int().min(0).max(10_000),
    mean: num,
    last: num,
    baseMean: num.optional(),
    baseStd: num.optional(),
    /** (last − baseMean) ÷ baseStd, when the baseline has a spread. */
    z: num.optional(),
  })
  .strict();

export const BriefSummarySchema = z
  .object({
    days: z.number().int().min(1).max(31),
    openAlerts: z
      .object({
        watch: z.number().int().min(0).max(1000),
        act: z.number().int().min(0).max(1000),
        keys: z.array(z.enum(MEASUREMENT_KEYS)).max(MEASUREMENT_KEYS.length),
      })
      .strict(),
    metrics: z.array(BriefMetricSchema).max(MEASUREMENT_KEYS.length),
    /** Radiation absorbed over the week, mGy (last − first cumulative reading). */
    radiationWeekMgy: num.optional(),
    checklist: z.object({ done: z.number().int().min(0).max(1000), total: z.number().int().min(0).max(1000) }).strict(),
  })
  .strict();

export type BriefMetric = z.infer<typeof BriefMetricSchema>;
export type BriefSummary = z.infer<typeof BriefSummarySchema>;

export interface BriefInput {
  days: number;
  measurements: readonly Measurement[];
  alerts: readonly Alert[];
  baselines: readonly Baseline[];
  radiation: readonly RadiationReading[];
  checklist: readonly ChecklistItem[];
}

const round = (v: number, digits = 2) => {
  const f = 10 ** digits;
  const r = Math.round(v * f) / f;
  return Object.is(r, -0) ? 0 : r;
};

/**
 * Pure: the same rows always give the same summary, in the same key order,
 * so its JSON (and the cache key hashed from it) is stable.
 */
export function buildBriefSummary(input: BriefInput): BriefSummary {
  const open = input.alerts.filter((a) => !a.ackedAt);
  const alertKeys = MEASUREMENT_KEYS.filter((k) => open.some((a) => a.key === k));

  const byKey = new Map<MeasurementKey, Measurement[]>();
  for (const m of input.measurements) {
    if (m.caseId || !Number.isFinite(m.value)) continue;
    const list = byKey.get(m.key) ?? [];
    list.push(m);
    byKey.set(m.key, list);
  }
  const baseline = new Map(input.baselines.map((b) => [b.key, b]));

  const metrics: BriefMetric[] = [];
  for (const key of MEASUREMENT_KEYS) {
    const rows = byKey.get(key);
    if (!rows?.length) continue;
    const sorted = [...rows].sort((a, b) => a.takenAt.localeCompare(b.takenAt));
    const last = sorted.at(-1)!.value;
    const metric: BriefMetric = {
      key,
      n: sorted.length,
      mean: round(sorted.reduce((s, m) => s + m.value, 0) / sorted.length),
      last: round(last),
    };
    const base = baseline.get(key);
    if (base && Number.isFinite(base.mean)) {
      metric.baseMean = round(base.mean);
      if (Number.isFinite(base.std)) metric.baseStd = round(base.std);
      if (base.std > 0) metric.z = round((last - base.mean) / base.std);
    }
    metrics.push(metric);
  }

  const summary: BriefSummary = {
    days: input.days,
    openAlerts: {
      watch: open.filter((a) => a.severity === "watch").length,
      act: open.filter((a) => a.severity === "act").length,
      keys: alertKeys,
    },
    metrics,
    checklist: { done: input.checklist.filter((i) => i.doneAt).length, total: input.checklist.length },
  };
  const rad = [...input.radiation].sort((a, b) => a.at.localeCompare(b.at));
  if (rad.length >= 2) summary.radiationWeekMgy = round(rad.at(-1)!.cumulativeMgy - rad[0]!.cumulativeMgy, 3);
  return summary;
}

/** Keys the brief is about: alerting keys first, then the rest with data, plus radiation when there is a total. */
export function briefKeys(summary: BriefSummary): MeasurementKey[] {
  const keys: MeasurementKey[] = [...summary.openAlerts.keys];
  for (const m of summary.metrics) if (!keys.includes(m.key)) keys.push(m.key);
  if (summary.radiationWeekMgy !== undefined && !keys.includes("radiationRate")) keys.push("radiationRate");
  return keys;
}
