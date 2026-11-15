import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { MISSION_DAY_TODAY, SIM_CREW, missionDayOf, resetDemoData, store } from "../../data/db";
import { saveItemValue, slugOf, unitFor } from "./checklistActions";

const MD = String(MISSION_DAY_TODAY);
async function item(slug: string) {
  return (await store.listChecklist(MD)).find((i) => slugOf(i) === slug)!;
}

describe("checklist inline values", () => {
  beforeEach(async () => {
    await resetDemoData();
  });

  it("knows the unit for each value row", async () => {
    expect(unitFor(await item("heart-rate"))).toBe("bpm");
    expect(unitFor(await item("aerobic"))).toBe("min");
    expect(unitFor(await item("dosimeter"))).toBe("µGy/h");
    expect(unitFor(await item("hydration"))).toBe("L");
    expect(unitFor(await item("vitamin-d"))).toBeUndefined();
  });

  it("a vital becomes a scored checklist measurement and marks the row done", async () => {
    await saveItemValue(await item("pain"), 2);
    const m = (await store.listMeasurements(SIM_CREW.id)).filter((x) => x.key === "painScore");
    expect(m.at(-1)).toMatchObject({ value: 2, source: "checklist" });
    expect(await item("pain")).toMatchObject({ value: 2 });
    expect((await item("pain")).doneAt).toBeDefined();
  });

  it("blood pressure writes systolic and diastolic", async () => {
    await saveItemValue(await item("blood-pressure"), 118, 76);
    const rows = await store.listMeasurements(SIM_CREW.id);
    expect(rows.filter((x) => x.key === "systolicBP").at(-1)?.value).toBe(118);
    expect(rows.filter((x) => x.key === "diastolicBP").at(-1)?.value).toBe(76);
    expect(await item("blood-pressure")).toMatchObject({ value: 118, value2: 76 });
  });

  it("exercise minutes complete today's planned workout in the fitness log", async () => {
    await saveItemValue(await item("aerobic"), 25);
    const today = (await store.listWorkouts(SIM_CREW.id)).filter(
      (w) => w.kind === "aerobic" && missionDayOf(w.at) === MISSION_DAY_TODAY,
    );
    expect(today).toHaveLength(1);
    expect(today[0]).toMatchObject({ minutes: 25, completed: true, plannedMinutes: 30 });
    expect(await item("aerobic")).toMatchObject({ value: 25 });
  });

  it("a dosimeter value goes through the radiation log", async () => {
    const before = (await store.listRadiation(SIM_CREW.id)).length;
    await saveItemValue(await item("dosimeter"), 18);
    const rad = await store.listRadiation(SIM_CREW.id);
    expect(rad).toHaveLength(before + 1);
    expect(rad.at(-1)).toMatchObject({ rateUgyPerHour: 18, source: "manual" });
    expect(await item("dosimeter")).toMatchObject({ value: 18 });
  });

  it("water intake is stored on the checklist item only", async () => {
    const measBefore = (await store.listMeasurements(SIM_CREW.id)).length;
    await saveItemValue(await item("hydration"), 1.5);
    expect((await store.listMeasurements(SIM_CREW.id)).length).toBe(measBefore);
    expect(await item("hydration")).toMatchObject({ value: 1.5 });
  });

  it("rejects negative or non-numeric values", async () => {
    await expect(saveItemValue(await item("hydration"), -1)).rejects.toThrow();
    await expect(saveItemValue(await item("hydration"), Number.NaN)).rejects.toThrow();
  });
});
