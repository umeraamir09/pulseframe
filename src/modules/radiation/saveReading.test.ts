import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { MISSION_DAY_TODAY, SIM_CREW, missionDayStart, resetDemoData, store } from "../../data/db";
import { nextCumulative, saveReading } from "./saveReading";

const CREW = SIM_CREW.id;
function tonight(minute = 0): string {
  const d = missionDayStart(MISSION_DAY_TODAY);
  d.setHours(21, minute);
  return d.toISOString();
}

describe("radiation log", () => {
  beforeEach(async () => {
    await resetDemoData();
  });

  it("seed: simulatedCAD readings, cumulative rises monotonically, no radiation alerts", async () => {
    const rows = await store.listRadiation(CREW);
    expect(rows.length).toBeGreaterThanOrEqual(6);
    expect(rows.every((r) => r.source === "simulatedCAD")).toBe(true);
    for (let i = 1; i < rows.length; i++) expect(rows[i].cumulativeMgy).toBeGreaterThan(rows[i - 1].cumulativeMgy);
    expect((await store.listAlerts(CREW)).some((a) => a.key === "radiationRate")).toBe(false);
  });

  it("18.0 adds a row and a higher cumulative point with no alert", async () => {
    const before = await store.listRadiation(CREW);
    const { reading, alert } = await saveReading(18.0, tonight());
    expect(alert).toBeUndefined();
    expect(reading.source).toBe("manual");
    expect(reading.cumulativeMgy).toBeGreaterThan(before.at(-1)!.cumulativeMgy);
    expect((await store.listRadiation(CREW)).length).toBe(before.length + 1);
    const m = (await store.listMeasurements(CREW)).find((x) => x.takenAt === reading.at && x.key === "radiationRate");
    expect(m).toMatchObject({ value: 18, unit: "µGy/h", source: "manual" });
  });

  it("19.0 creates an act alert that the dashboard list also sees", async () => {
    await saveReading(18.0, tonight());
    const { alert } = await saveReading(19.0, tonight(10));
    expect(alert?.key).toBe("radiationRate");
    expect(alert?.severity).toBe("act");
    expect((await store.listAlerts(CREW)).some((a) => a.id === alert!.id)).toBe(true);
  });

  it("integrates rate over the hours since the last reading", () => {
    const last = { id: "r", crewId: CREW, at: "2026-11-15T00:00:00.000Z", cumulativeMgy: 1, source: "manual" as const };
    expect(nextCumulative(last, 20, "2026-11-15T10:00:00.000Z")).toBeCloseTo(1.2, 6);
    expect(nextCumulative(undefined, 20, "2026-11-15T10:00:00.000Z")).toBe(0);
  });

  it("rejects negative or non-numeric rates", async () => {
    await expect(saveReading(-1)).rejects.toThrow();
    await expect(saveReading(Number.NaN)).rejects.toThrow();
  });

  it("ticks today's dosimeter checklist item", async () => {
    await saveReading(18.0, tonight(20));
    const item = (await store.listChecklist(String(MISSION_DAY_TODAY))).find((i) => i.kind === "radiation");
    expect(item?.doneAt).toBeDefined();
  });
});
