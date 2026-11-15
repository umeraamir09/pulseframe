import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { UNITS } from "../contracts";
import { beginDemoData, demoDataActive, endDemoData } from "./demoSession";
import { MISSION_DAY_TODAY, missionDayOf, missionDayStart } from "./mission";
import { resetDemoData } from "./seed";
import { SIM_CREW, STORE_NAMES, connect, store } from "./store";
import { useSyncSettings } from "./sync";

const CREW = SIM_CREW.id;

/** 10:00 on MD 142, so the morning rows exist and the evening ones do not. */
function morning(): Date {
  const d = missionDayStart(MISSION_DAY_TODAY);
  d.setHours(10, 0, 0, 0);
  return d;
}

async function dump(): Promise<Record<string, unknown[]>> {
  const db = await connect();
  const out: Record<string, unknown[]> = {};
  for (const name of STORE_NAMES) out[name] = await db.getAll(name);
  return out;
}

async function record(key: "heartRate" | "systolicBP" | "diastolicBP" | "radiationRate", value: number, at: Date) {
  return store.recordMeasurement({ crewId: CREW, key, value, unit: UNITS[key], source: "checklist", takenAt: at.toISOString() });
}

describe("demo session", () => {
  beforeEach(async () => {
    await endDemoData();
    await resetDemoData();
    await store.setMeta("realNote", "kept");
    useSyncSettings.getState().set({ delaySec: 8, linkUp: true, dropRate: 0 });
  });

  it("loads a normal week with no open alerts and today's morning vitals still open", async () => {
    await beginDemoData(morning());
    expect(await demoDataActive()).toBe(true);
    expect(await store.listAlerts(CREW)).toHaveLength(0);
    const hrToday = (await store.listMeasurements(CREW)).filter((m) => m.key === "heartRate" && missionDayOf(m.takenAt) === MISSION_DAY_TODAY);
    expect(hrToday).toHaveLength(0);
    const today = await store.listChecklist(String(MISSION_DAY_TODAY));
    expect(today.find((i) => i.id.endsWith("heart-rate"))?.doneAt).toBeUndefined();
    expect(today.find((i) => i.id.endsWith("dosimeter"))?.doneAt).toBeUndefined();
    expect(await store.getMeta("realNote")).toBeUndefined();
    expect(useSyncSettings.getState().delaySec).toBe(2);
  });

  it("raises Act for a morning heart rate of 78 and keeps the scripted placeholders normal", async () => {
    await beginDemoData(morning());
    const at = morning();
    const hr = await record("heartRate", 78, at);
    expect(hr.alert?.severity).toBe("act");
    expect(hr.alert?.mean).toBeCloseTo(63.33, 1);
    expect(hr.alert?.zScore).toBeCloseTo(5.23, 1);
    expect((await record("systolicBP", 118, at)).alert).toBeUndefined();
    expect((await record("diastolicBP", 75, at)).alert).toBeUndefined();
    expect((await record("radiationRate", 6.3, at)).alert).toBeUndefined();
  });

  it("wipes every demo row and brings back the crew's own data and link settings", async () => {
    const before = await dump();
    await beginDemoData(morning());
    await record("heartRate", 78, morning());
    await store.saveCase({ id: "case-demo", crewId: CREW, narrative: "Nausea", regionIds: [], startedAt: morning().toISOString(), status: "open", stage: "pinpoint" });
    useSyncSettings.getState().set({ linkUp: false });

    expect(await endDemoData()).toBe(true);
    expect(await dump()).toEqual(before);
    expect(await store.getMeta("realNote")).toBe("kept");
    expect(await store.getOpenCase(CREW)).toBeUndefined();
    expect(useSyncSettings.getState().linkUp).toBe(true);
    expect(await demoDataActive()).toBe(false);
    expect(await endDemoData()).toBe(false);
  });

  it("keeps the first backup when a demo is replayed before it was wiped", async () => {
    const before = await dump();
    await beginDemoData(morning());
    await record("heartRate", 78, morning());
    await beginDemoData(morning());
    await endDemoData();
    expect(await dump()).toEqual(before);
  });
});
