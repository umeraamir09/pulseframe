import { describe, expect, it } from "vitest";
import type { Alert, Measurement, MeasurementKey } from "../contracts";
import { UNITS } from "../contracts";
import { dedupe, replayAlerts, rollingBaselineSeries, scoreMeasurement, windowStats, baselineWindow } from "./anomaly";
import { MISSION_DAY_TODAY, missionDayOf, missionDayStart } from "./mission";
import { buildSeed } from "./seed";

const CREW = "crew-sim-01";

/** Full 7-day seed: "now" is late on MD 142 so no rows are dropped. */
function seedRows(): Measurement[] {
  const now = missionDayStart(MISSION_DAY_TODAY);
  now.setHours(23, 30);
  return buildSeed(now).measurements.map((m, i) => ({ ...m, id: `m-${i}` }));
}

function reading(key: MeasurementKey, value: number, md: number, hour: number, extra: Partial<Measurement> = {}): Measurement {
  const t = missionDayStart(md);
  t.setMinutes(hour * 60);
  return { id: `x-${key}-${md}-${hour}`, crewId: CREW, key, value, unit: UNITS[key], source: "manual", takenAt: t.toISOString(), ...extra };
}

describe("seed scenario", () => {
  const { alerts } = replayAlerts(seedRows());
  const find = (key: MeasurementKey, md: number) => alerts.find((a) => a.key === key && missionDayOf(a.openedAt) === md);

  it("produces exactly 4 alerts", () => {
    expect(alerts.map((a) => `${a.key}@${missionDayOf(a.openedAt)}:${a.severity}`).sort()).toEqual(
      ["heartRate@142:act", "sleepHours@139:act", "sleepHours@140:watch", "sleepQuality@139:watch"].sort(),
    );
  });

  it("sleepHours MD 139 is act, μ 7.20, σ 0.200, z -10.50", () => {
    const a = find("sleepHours", 139)!;
    expect(a.ruleId).toBe("z-act");
    expect(a.mean).toBeCloseTo(7.2, 2);
    expect(a.std).toBeCloseTo(0.2, 3);
    expect(a.zScore).toBeCloseTo(-10.5, 2);
  });

  it("sleepQuality MD 139 is a hard-bound watch (σ is 0)", () => {
    const a = find("sleepQuality", 139)!;
    expect(a.ruleId).toBe("hard-bound");
    expect(a.severity).toBe("watch");
    expect(a.zScore).toBeUndefined();
  });

  it("sleepHours MD 140 is watch, μ 6.68, σ 1.063, z -2.14", () => {
    const a = find("sleepHours", 140)!;
    expect(a.ruleId).toBe("z-watch");
    expect(a.mean).toBeCloseTo(6.675, 2);
    expect(a.std).toBeCloseTo(1.063, 3);
    expect(a.zScore).toBeCloseTo(-2.14, 2);
  });

  it("heartRate MD 142 is act, μ 63.33, σ 2.805, z 5.23", () => {
    const a = find("heartRate", 142)!;
    expect(a.ruleId).toBe("z-act");
    expect(a.mean).toBeCloseTo(63.33, 2);
    expect(a.std).toBeCloseTo(2.805, 3);
    expect(a.zScore).toBeCloseTo(5.23, 2);
    expect(a.sampleCount).toBe(6);
  });

  it("every message ends with the not-a-diagnosis line", () => {
    for (const a of alerts) expect(a.message.endsWith("It is not a diagnosis.")).toBe(true);
  });
});

describe("emergency test reading", () => {
  const rows = seedRows();
  const hr96 = reading("heartRate", 96, 142, 10, { caseId: "case-1", source: "emergency-test" });

  it("heart rate 96 with a caseId gives act, z ≈ 5.01, μ ≈ 65.43", () => {
    const { draft } = scoreMeasurement(hr96, [...rows, hr96]);
    expect(draft?.severity).toBe("act");
    expect(draft?.zScore).toBeCloseTo(5.01, 2);
    expect(draft?.mean).toBeCloseTo(65.43, 2);
    expect(draft?.caseId).toBe("case-1");
  });

  it("is excluded from later baselines", () => {
    const later = reading("heartRate", 70, 142, 21);
    const all = [...rows, hr96, later];
    const withCase = rollingBaselineSeries(all, "heartRate").at(-1)!;
    const without = rollingBaselineSeries([...rows, later], "heartRate").at(-1)!;
    expect(withCase.mean).toBeCloseTo(without.mean!, 10);
    expect(baselineWindow(later, all).some((m) => m.caseId)).toBe(false);
  });
});

describe("rules", () => {
  const rows = seedRows();

  it("burn-in: no z-score on MD 138 (only 2 prior days)", () => {
    const md138 = rows.find((m) => m.key === "heartRate" && missionDayOf(m.takenAt) === 138)!;
    expect(windowStats(baselineWindow(md138, rows)).usable).toBe(false);
    expect(rollingBaselineSeries(rows, "heartRate")[2].low).toBeUndefined();
    expect(rollingBaselineSeries(rows, "heartRate")[3].low).toBeDefined();
  });

  it("near-zero σ: teamStrain 2 gives no alert, teamStrain 4 gives a hard-bound watch", () => {
    expect(scoreMeasurement(reading("teamStrain", 2, 142, 21), rows).draft).toBeUndefined();
    const d = scoreMeasurement(reading("teamStrain", 4, 142, 21), rows).draft;
    expect(d?.ruleId).toBe("hard-bound");
    expect(d?.severity).toBe("watch");
  });

  it("radiationRate 19.0 on MD 142 is act, z ≈ 10.69", () => {
    const d = scoreMeasurement(reading("radiationRate", 19, 142, 18), rows).draft;
    expect(d?.severity).toBe("act");
    expect(d?.zScore).toBeCloseTo(10.69, 1);
  });

  it("normal temperature 36.6 gives no alert", () => {
    expect(scoreMeasurement(reading("temperatureC", 36.6, 142, 21), rows).draft).toBeUndefined();
  });

  it("dedupe: higher severity replaces, equal or lower is kept out", () => {
    const watch = scoreMeasurement(reading("teamStrain", 4, 142, 21), rows).draft!;
    const act = scoreMeasurement(reading("teamStrain", 5, 142, 22), rows).draft!;
    const existingWatch: Alert = { ...watch, id: "al-1" };
    expect(dedupe(act, [existingWatch])).toEqual({ action: "replace", old: existingWatch });
    expect(dedupe(watch, [{ ...act, id: "al-2" }])).toEqual({ action: "keep" });
    expect(dedupe(act, [{ ...existingWatch, ackedAt: new Date().toISOString() }])).toEqual({ action: "add" });
  });
});
