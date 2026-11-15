import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { MISSION_DAY_TODAY, SIM_CREW, missionDayLabel, missionDayOf, missionDayStart, resetDemoData, store } from "../../data/db";
import { saveCheckIn } from "./saveCheckIn";

const CREW = SIM_CREW.id;
/** 21:00 on MD 142, after the seeded 20:00 check-in, so the baseline window is the full week. */
function tonight(minute = 0): string {
  const d = missionDayStart(MISSION_DAY_TODAY);
  d.setHours(21, minute);
  return d.toISOString();
}

describe("psych check-in", () => {
  beforeEach(async () => {
    await resetDemoData();
  });

  it("seeded table: MD 139 shows mood 3 and sleep quality 2", async () => {
    const checks = await store.listPsych(CREW);
    const md139 = checks.find((c) => missionDayLabel(missionDayOf(c.at)) === "MD 139");
    expect(md139).toMatchObject({ mood: 3, sleepQuality: 2 });
  });

  it("a calm check-in saves 1 psych row and 4 measurements with no alerts", async () => {
    const psychBefore = (await store.listPsych(CREW)).length;
    const measBefore = (await store.listMeasurements(CREW)).length;
    const alertsBefore = (await store.listAlerts(CREW)).length;

    const { check, alerts } = await saveCheckIn(
      { mood: 4, stress: 2, teamStrain: 2, sleepQuality: 4, includeNote: false },
      tonight(),
    );

    expect(alerts).toEqual([]);
    expect((await store.listPsych(CREW)).length).toBe(psychBefore + 1);
    const added = (await store.listMeasurements(CREW)).filter((m) => m.takenAt === check.at);
    expect(added.map((m) => m.key).sort()).toEqual(["moodScore", "sleepQuality", "stressScore", "teamStrain"]);
    expect(added.every((m) => m.source === "manual")).toBe(true);
    expect((await store.listMeasurements(CREW)).length).toBe(measBefore + 4);
    expect((await store.listAlerts(CREW)).length).toBe(alertsBefore);
  });

  it("stress 5 raises an act stress alert that the dashboard list also sees", async () => {
    const { alerts } = await saveCheckIn({ mood: 4, stress: 5, teamStrain: 2, sleepQuality: 4, includeNote: false }, tonight(5));
    const stress = alerts.find((a) => a.key === "stressScore");
    expect(stress?.severity).toBe("act");
    expect((await store.listAlerts(CREW)).some((a) => a.id === stress!.id)).toBe(true);
  });

  it("a private note is not on the PsychCheck and is kept in meta", async () => {
    const { check } = await saveCheckIn(
      { mood: 3, stress: 3, teamStrain: 2, sleepQuality: 3, note: "  rough day  ", includeNote: false },
      tonight(10),
    );
    expect(check.note).toBeUndefined();
    expect(await store.getMeta(`psychNote:${check.id}`)).toBe("rough day");
  });

  it("an included note is saved on the PsychCheck", async () => {
    const { check } = await saveCheckIn(
      { mood: 3, stress: 3, teamStrain: 2, sleepQuality: 3, note: "ok", includeNote: true },
      tonight(15),
    );
    expect(check.note).toBe("ok");
    expect(await store.getMeta(`psychNote:${check.id}`)).toBeUndefined();
  });

  it("ticks today's psychology checklist item", async () => {
    await saveCheckIn({ mood: 4, stress: 2, teamStrain: 2, sleepQuality: 4, includeNote: false }, tonight(20));
    const item = (await store.listChecklist(String(MISSION_DAY_TODAY))).find((i) => i.kind === "psych");
    expect(item?.doneAt).toBeDefined();
  });
});
