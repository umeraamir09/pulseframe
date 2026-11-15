import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import type { Alert } from "../../contracts";
import { replayAlerts } from "../../data/anomaly";
import { SIM_CREW, rebuildAlerts, store } from "../../data/db";
import { MISSION_DAY_TODAY, missionDayStart } from "../../data/mission";
import { buildSeed } from "../../data/seed";
import { putRaw } from "../../data/store";
import {
  advance,
  closeCase,
  completeStep,
  emergencyMeasurement,
  handoffCase,
  recordCaseMeasurement,
  retreat,
  setRegions,
  skipRemainingActions,
  startCase,
} from "./caseActions";
import { buildCurrentInfo } from "./currentInfo";
import { regionsWithOpenAlerts } from "./flags";
import { visibleStage } from "./flow";

function afternoon(): Date {
  const now = missionDayStart(MISSION_DAY_TODAY);
  now.setHours(15, 0, 0, 0);
  return now;
}

async function seedAfternoon(): Promise<void> {
  const bundle = buildSeed(afternoon());
  await store.resetAll();
  await putRaw(
    "measurements",
    bundle.measurements.map((row, index) => ({ ...row, id: `m-${index}` })),
  );
  await putRaw("workouts", bundle.workouts);
  await store.putInventory(bundle.inventory);
  await rebuildAlerts(SIM_CREW.id);
}

function fakeAlert(partial: Partial<Alert> & Pick<Alert, "key">): Alert {
  return {
    id: partial.id ?? partial.key,
    crewId: SIM_CREW.id,
    severity: "act",
    ruleId: "z-act",
    message: "",
    value: 1,
    openedAt: afternoon().toISOString(),
    ...partial,
  };
}

describe("emergency case flow", () => {
  beforeEach(async () => {
    await seedAfternoon();
  });

  it("treats a missing case as intake", () => {
    expect(visibleStage(undefined)).toBe("intake");
  });

  it("refuses an empty narrative", async () => {
    await expect(startCase("  ")).rejects.toThrow(/Describe what is happening/);
  });

  it("matches the scripted chest case and resumes the same stage", async () => {
    const opened = await startCase("Chest tightness after resistive exercise session");
    expect(opened.stage).toBe("pinpoint");
    expect(opened.protocolId).toBeUndefined();
    await setRegions(["chest"]);
    await advance("current-info");
    expect((await store.getOpenCase(SIM_CREW.id))?.protocolId).toBeUndefined();

    const snap = JSON.stringify({ rows: [], openAlertIds: [] });
    const matched = await advance("differential", { currentInfoSnapshot: snap });
    expect(matched?.protocolId).toBe("chest-tightness-post-exercise");
    expect(matched?.currentInfoSnapshot).toBe(snap);
    expect(matched?.regionIds).toEqual(["chest"]);

    const steps = await store.listSteps(opened.id);
    expect(steps.filter((step) => step.kind === "test")).toHaveLength(6);
    expect(steps.filter((step) => step.kind === "action")).toHaveLength(5);

    await advance("differential");
    expect(await store.listSteps(opened.id)).toHaveLength(steps.length);

    const resumed = await store.getOpenCase(SIM_CREW.id);
    expect(resumed?.stage).toBe("differential");
    expect(resumed?.regionIds).toEqual(["chest"]);
    expect(resumed?.narrative).toBe("Chest tightness after resistive exercise session");
  });

  it("matches a headache on the head to the general fallback", async () => {
    const opened = await startCase("headache");
    await setRegions(["head"]);
    await advance("current-info");
    await advance("differential");
    const saved = await store.getOpenCase(SIM_CREW.id);
    expect(saved?.protocolId).toBe("general-fallback");
    const steps = await store.listSteps(opened.id);
    expect(steps.filter((step) => step.kind === "test")).toHaveLength(6);
    expect(steps.filter((step) => step.kind === "action")).toHaveLength(3);
  });

  it("shows heart rate 78 bpm with μ about 63.3 and the open Act alert", async () => {
    const [measurements, baselines, alerts] = await Promise.all([
      store.listMeasurements(SIM_CREW.id),
      store.getBaselines(SIM_CREW.id),
      store.listAlerts(SIM_CREW.id),
    ]);
    const snap = buildCurrentInfo(measurements, baselines, alerts, afternoon());
    const hr = snap.rows.find((row) => row.key === "heartRate");
    expect(hr).toMatchObject({ value: 78, unit: "bpm" });
    expect(hr?.mean).toBeCloseTo(63.3, 1);
    const openHr = alerts.find((alert) => !alert.ackedAt && alert.key === "heartRate" && alert.severity === "act");
    expect(openHr?.zScore).toBeCloseTo(5.23, 1);
    expect(snap.openAlertIds).toContain(openHr?.id);

    const seeded = buildSeed(afternoon()).measurements.map((row, index) => ({ ...row, id: `pure-${index}` }));
    const replayed = replayAlerts(seeded);
    const pure = buildCurrentInfo(seeded, replayed.baselines, replayed.alerts.map((alert, index) => ({ ...alert, id: `al-${index}` })), afternoon());
    expect(pure.rows.find((row) => row.key === "heartRate")?.mean).toBeCloseTo(63.3, 1);
  });

  it("saves heart rate 96 as an emergency test and raises an Act alert near z 5.0", async () => {
    const opened = await startCase("Chest tightness after resistive exercise session");
    const { measurement, alert } = await store.recordMeasurement(
      emergencyMeasurement(SIM_CREW.id, opened.id, "heartRate", 96, afternoon().toISOString()),
    );
    expect(measurement).toMatchObject({ source: "emergency-test", caseId: opened.id, key: "heartRate", value: 96 });
    expect(alert).toMatchObject({ severity: "act", caseId: opened.id });
    expect(alert?.zScore).toBeCloseTo(5.01, 1);

    const heart = (await store.listAlerts(SIM_CREW.id)).filter((row) => row.key === "heartRate" && !row.ackedAt);
    expect(heart).toHaveLength(2);

    const viaHelper = await recordCaseMeasurement(opened.id, "painScore", 3);
    expect(viaHelper.measurement).toMatchObject({ source: "emergency-test", caseId: opened.id, value: 3 });

    const testStepId = "step-hr";
    await store.saveSteps([
      {
        id: testStepId,
        caseId: opened.id,
        kind: "test",
        title: "Heart rate",
        instruction: "Rest, then read heart rate.",
        inputKey: "heartRate",
        completed: false,
        order: 0,
      },
    ]);
    await completeStep(testStepId, { resultValue: 96, measurementId: measurement.id });
    const [saved] = await store.listSteps(opened.id);
    expect(saved).toMatchObject({ completed: true, resultValue: 96, measurementId: measurement.id });
  });

  it("stores a skip reason on unfinished action steps", async () => {
    const opened = await startCase("Chest tightness after resistive exercise session");
    await setRegions(["chest"]);
    await advance("current-info");
    await advance("differential");
    await skipRemainingActions("crew already resting");
    const actions = (await store.listSteps(opened.id)).filter((step) => step.kind === "action");
    expect(actions.every((step) => step.completed)).toBe(true);
    expect(actions[0]?.instruction).toContain("Skipped: crew already resting");
  });

  it("queues one emergency packet and then closes back to intake", async () => {
    const opened = await startCase("Chest tightness after resistive exercise session");
    await setRegions(["chest"]);
    await handoffCase(opened.id);
    await handoffCase(opened.id);
    const packets = (await store.listPackets()).filter((packet) => packet.kind === "emergency-case");
    expect(packets).toHaveLength(1);
    expect(packets[0]).toMatchObject({ priority: "emergency", kind: "emergency-case" });
    const monitoring = await store.getCase(opened.id);
    expect(monitoring).toMatchObject({ status: "monitoring", stage: "monitoring", packetId: packets[0]?.id });

    await closeCase();
    expect(await store.getOpenCase(SIM_CREW.id)).toBeUndefined();
    const closed = await store.getCase(opened.id);
    expect(closed?.status).toBe("closed");
    expect(closed?.closedAt).toBeTruthy();
    expect(visibleStage(undefined)).toBe("intake");

    const fresh = await startCase("headache");
    expect(fresh.id).not.toBe(opened.id);
    expect(fresh.stage).toBe("pinpoint");
    expect(await store.getOpenCase(SIM_CREW.id)).toMatchObject({ id: fresh.id, stage: "pinpoint" });
  });

  it("retreats only before a protocol is chosen and keeps the selected regions", async () => {
    await startCase("Chest tightness after resistive exercise session");
    await setRegions(["chest", "abdomen"]);
    await advance("current-info");
    await setRegions([]);
    expect((await store.getOpenCase(SIM_CREW.id))?.regionIds).toEqual(["chest", "abdomen"]);
    await retreat();
    expect((await store.getOpenCase(SIM_CREW.id))?.stage).toBe("pinpoint");
    await retreat();
    const back = await store.getOpenCase(SIM_CREW.id);
    expect(back?.stage).toBe("intake");
    expect(back?.regionIds).toEqual(["chest", "abdomen"]);
  });

  it("flags chest for heart rate and skin for temperature", () => {
    expect(
      regionsWithOpenAlerts([
        fakeAlert({ key: "heartRate" }),
        fakeAlert({ key: "temperatureC", id: "temp" }),
        fakeAlert({ key: "sleepHours", id: "sleep" }),
        fakeAlert({ key: "oxygenSat", id: "o2", ackedAt: afternoon().toISOString() }),
      ]),
    ).toEqual(["chest", "skin"]);
  });
});
