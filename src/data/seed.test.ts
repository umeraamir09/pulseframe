import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CHECKLIST_TEMPLATE } from "./checklistTemplate";
import { ACTIVE_INVENTORY } from "./inventory";
import { MISSION_DAY_TODAY, missionDayOf, missionDayStart } from "./mission";
import { SEED_SERIES, SEED_VERSION, buildSeed, resetDemoData, seedIfNeeded } from "./seed";
import { SIM_CREW, connect, store } from "./store";

const CREW = SIM_CREW.id;
const PER_DAY = CHECKLIST_TEMPLATE.length;

function at(md: number, h: number, m = 0): Date {
  const d = missionDayStart(md);
  d.setHours(h, m);
  return d;
}

describe("buildSeed (pure)", () => {
  const evening = buildSeed(at(MISSION_DAY_TODAY, 23, 30));

  it("in the evening holds the full week", () => {
    expect(evening.measurements).toHaveLength(Object.keys(SEED_SERIES).length * 7); // 84
    expect(evening.psych).toHaveLength(7);
    expect(evening.radiation).toHaveLength(7);
    expect(evening.workouts).toHaveLength(14);
    expect(evening.checklist).toHaveLength(PER_DAY * 7);
    expect(evening.inventory).toHaveLength(ACTIVE_INVENTORY.length);
  });

  it("drops rows later than now (08:00 on MD 142)", () => {
    const morning = buildSeed(at(MISSION_DAY_TODAY, 8));
    expect(morning.measurements.length).toBeLessThan(84);
    expect(morning.psych).toHaveLength(6);
    expect(morning.radiation).toHaveLength(6);
    expect(morning.workouts).toHaveLength(13);
    expect(morning.measurements.every((m) => Date.parse(m.takenAt) <= at(MISSION_DAY_TODAY, 8).getTime())).toBe(true);
  });

  it("MD 142 heart rate is 78 at 07:00 local today", () => {
    const hr = evening.measurements.filter((m) => m.key === "heartRate").at(-1)!;
    expect(hr.value).toBe(78);
    expect(missionDayOf(hr.takenAt)).toBe(MISSION_DAY_TODAY);
    expect(new Date(hr.takenAt).getHours()).toBe(7);
    expect(new Date(hr.takenAt).getMinutes()).toBe(0);
  });

  it("uses the right sources and units", () => {
    const sleep = evening.measurements.find((m) => m.key === "sleepHours")!;
    const hr = evening.measurements.find((m) => m.key === "heartRate")!;
    expect(sleep.source).toBe("manual");
    expect(hr.source).toBe("device-sim");
    expect(hr.unit).toBe("bpm");
    expect(evening.radiation.every((r) => r.source === "simulatedCAD")).toBe(true);
  });

  it("radiation is a running cumulative sum of rate * 24 / 1000", () => {
    const expected = SEED_SERIES.radiationRate!.reduce((s, r) => s + (r * 24) / 1000, 0);
    expect(evening.radiation.at(-1)!.cumulativeMgy).toBeCloseTo(expected, 3);
  });

  it("aerobic is skipped on MD 139, MD 140 and (open) MD 142", () => {
    const skipped = evening.workouts.filter((w) => !w.completed).map((w) => w.id);
    expect(skipped.sort()).toEqual(["wo-139-aerobic", "wo-140-aerobic", "wo-142-aerobic"]);
  });

  it("checklist: MD 142 has vitals, sleep and resistive done; MD 139 has aerobic open", () => {
    const today = evening.checklist.filter((i) => i.missionDay === String(MISSION_DAY_TODAY));
    const done = today.filter((i) => i.doneAt).map((i) => i.id.replace(`chk-${MISSION_DAY_TODAY}-`, ""));
    expect(done.sort()).toEqual(
      ["blood-glucose", "blood-pressure", "heart-rate", "oxygen-sat", "resistive", "sleep", "temperature"].sort(),
    );
    const required = today.filter((i) => i.required);
    expect(`${required.filter((i) => i.doneAt).length} of ${required.length}`).toBe("6 of 11");
    expect(evening.checklist.find((i) => i.id === "chk-139-aerobic")!.doneAt).toBeUndefined();
    expect(evening.checklist.find((i) => i.id === "chk-142-blood-pressure")).toMatchObject({ value: 114, value2: 73 });
  });

  it("never puts a dose in the checklist", () => {
    for (const i of evening.checklist) expect(`${i.label} ${i.note ?? ""}`).not.toMatch(/\b\d+\s?(mg|IU|mcg|µg)\b/i);
  });

  it("is deterministic for the same now", () => {
    const now = at(MISSION_DAY_TODAY, 23, 30);
    expect(JSON.stringify(buildSeed(now))).toBe(JSON.stringify(buildSeed(now)));
  });
});

async function counts(): Promise<Record<string, number>> {
  const db = await connect();
  const names = ["measurements", "psych", "radiation", "workouts", "checklist", "inventory", "alerts"] as const;
  const out: Record<string, number> = {};
  for (const n of names) out[n] = await db.count(n);
  return out;
}

describe("resetDemoData and seedIfNeeded (IndexedDB)", () => {
  it("writes the bundle for now, rebuilds alerts and stamps the seed version", async () => {
    await resetDemoData();
    const expected = buildSeed(new Date());
    const c = await counts();
    expect(c.measurements).toBe(expected.measurements.length);
    expect(c.psych).toBe(expected.psych.length);
    expect(c.radiation).toBe(expected.radiation.length);
    expect(c.workouts).toBe(expected.workouts.length);
    expect(c.checklist).toBe(PER_DAY * 7);
    expect(c.inventory).toBe(ACTIVE_INVENTORY.length);
    expect(await store.getMeta("seedVersion")).toBe(SEED_VERSION);
  });

  it("produces the 3 to 4 expected alerts (heart rate only after 07:00 on MD 142)", async () => {
    const alerts = await store.listAlerts(CREW);
    const keys = alerts.map((a) => `${a.key}@${missionDayOf(a.openedAt)}:${a.severity}`).sort();
    const base = ["sleepHours@139:act", "sleepHours@140:watch", "sleepQuality@139:watch"];
    const hrSeeded = buildSeed(new Date()).measurements.some(
      (m) => m.key === "heartRate" && missionDayOf(m.takenAt) === MISSION_DAY_TODAY,
    );
    expect(keys).toEqual((hrSeeded ? [...base, "heartRate@142:act"] : base).sort());
  });

  it("running it twice gives the same counts and the same values", async () => {
    const values = async () =>
      (await store.listMeasurements(CREW)).map((m) => `${m.key}:${m.takenAt}:${m.value}`).join("|");
    const first = { c: await counts(), v: await values() };
    await resetDemoData();
    expect(await counts()).toEqual(first.c);
    expect(await values()).toBe(first.v);
  });

  it("seedIfNeeded keeps data when the version matches and reseeds when it changes", async () => {
    const extra = await store.addMeasurement({
      crewId: CREW,
      key: "heartRate",
      value: 70,
      unit: "bpm",
      source: "manual",
      takenAt: new Date().toISOString(),
    });
    await seedIfNeeded();
    expect((await store.listMeasurements(CREW)).some((m) => m.id === extra.id)).toBe(true);

    await store.setMeta("seedVersion", SEED_VERSION - 1);
    await seedIfNeeded();
    expect((await store.listMeasurements(CREW)).some((m) => m.id === extra.id)).toBe(false);
    expect(await store.getMeta("seedVersion")).toBe(SEED_VERSION);
  });
});
