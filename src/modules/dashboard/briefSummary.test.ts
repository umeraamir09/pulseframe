import { describe, expect, it } from "vitest";
import type { Alert, Baseline, ChecklistItem, Measurement, RadiationReading } from "../../contracts";
import { BriefSummarySchema, briefKeys, buildBriefSummary, type BriefInput } from "./briefSummary";

const CREW = "crew-secret-01";

function m(key: Measurement["key"], value: number, day: number, extra: Partial<Measurement> = {}): Measurement {
  return {
    id: `meas-raw-${key}-${day}`,
    crewId: CREW,
    key,
    value,
    unit: "x",
    takenAt: `2026-01-0${day}T07:00:00.000Z`,
    source: "manual",
    note: "private free text",
    ...extra,
  } as Measurement;
}

function sampleInput(): BriefInput {
  const alerts: Alert[] = [
    { id: "alert-raw-1", crewId: CREW, key: "heartRate", severity: "watch", ruleId: "z-watch", message: "raw message", value: 80, openedAt: "2026-01-03T07:00:00.000Z" },
    { id: "alert-raw-2", crewId: CREW, key: "sleepHours", severity: "act", ruleId: "z-act", message: "raw", value: 4, openedAt: "2026-01-03T07:00:00.000Z" },
    { id: "alert-raw-3", crewId: CREW, key: "oxygenSat", severity: "watch", ruleId: "z-watch", message: "acked", value: 94, openedAt: "2026-01-02T07:00:00.000Z", ackedAt: "2026-01-02T08:00:00.000Z" },
  ];
  const baselines: Baseline[] = [
    { crewId: CREW, key: "heartRate", windowDays: 7, mean: 62, std: 4, updatedAt: "2026-01-03T07:00:00.000Z" },
  ];
  const radiation: RadiationReading[] = [
    { id: "rad-1", crewId: CREW, at: "2026-01-01T00:00:00.000Z", cumulativeMgy: 10, source: "simulatedCAD" },
    { id: "rad-2", crewId: CREW, at: "2026-01-03T00:00:00.000Z", cumulativeMgy: 10.95, source: "simulatedCAD" },
  ];
  const checklist = [
    { id: "c1", missionDay: "3", label: "Vitals", kind: "vitals", required: true, doneAt: "2026-01-03T07:00:00.000Z" },
    { id: "c2", missionDay: "3", label: "Psych", kind: "psych", required: true },
  ] as ChecklistItem[];
  return {
    days: 7,
    measurements: [
      m("heartRate", 60, 1),
      m("heartRate", 64, 2),
      m("heartRate", 70, 3),
      m("heartRate", 150, 3, { caseId: "case-1", id: "meas-case" }),
      m("sleepHours", 6.5, 2),
    ],
    alerts,
    baselines,
    radiation,
    checklist,
  };
}

describe("buildBriefSummary", () => {
  const summary = buildBriefSummary(sampleInput());

  it("reduces rows to per-key aggregates against the personal baseline", () => {
    expect(summary).toEqual({
      days: 7,
      openAlerts: { watch: 1, act: 1, keys: ["heartRate", "sleepHours"] },
      metrics: [
        { key: "heartRate", n: 3, mean: 64.67, last: 70, baseMean: 62, baseStd: 4, z: 2 },
        { key: "sleepHours", n: 1, mean: 6.5, last: 6.5 },
      ],
      checklist: { done: 1, total: 2 },
      radiationWeekMgy: 0.95,
    });
    expect(BriefSummarySchema.parse(summary)).toEqual(summary);
  });

  it("sends no raw rows: no ids, crew, timestamps, notes, messages or case readings", () => {
    const json = JSON.stringify(summary);
    for (const leak of ["meas-raw", "alert-raw", "rad-1", CREW, "2026-", "private", "raw message", "case-1", "150", "Vitals"]) {
      expect(json).not.toContain(leak);
    }
    expect(json.length).toBeLessThan(600);
  });

  it("is deterministic regardless of row order", () => {
    const input = sampleInput();
    const shuffled = { ...input, measurements: [...input.measurements].reverse(), radiation: [...input.radiation].reverse() };
    expect(JSON.stringify(buildBriefSummary(shuffled))).toBe(JSON.stringify(summary));
  });

  it("names alerting keys first, then other keys, then radiation", () => {
    expect(briefKeys(summary)).toEqual(["heartRate", "sleepHours", "radiationRate"]);
  });

  it("rejects extra fields on the server schema", () => {
    expect(BriefSummarySchema.safeParse({ ...summary, rows: [] }).success).toBe(false);
  });
});
