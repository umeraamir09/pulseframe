import { UNITS } from "../contracts";
import type {
  ChecklistItem,
  InventoryItem,
  Measurement,
  MeasurementKey,
  PsychCheck,
  RadiationReading,
  Workout,
} from "../contracts";
import { CHECKLIST_TEMPLATE, checklistItemId } from "./checklistTemplate";
import { rebuildAlerts } from "./alerts";
import { ACTIVE_INVENTORY } from "./inventory";
import { DEMO_WORKOUT_PLAN } from "./workoutPlan";
import { FIRST_SEED_DAY, MISSION_DAY_TODAY, missionDayOf, missionDayStart } from "./mission";
import { SIM_CREW, putRaw, store } from "./store";

/** Bump to force every device to reseed on next load. */
export const SEED_VERSION = 4;

/** Simulated values, MD 136 to MD 142. Not reference ranges and not ISS data. */
export const SEED_SERIES: Partial<Record<MeasurementKey, number[]>> = {
  heartRate: [60, 66, 62, 64, 67, 61, 78],
  systolicBP: [112, 114, 111, 113, 114, 112, 114],
  diastolicBP: [72, 74, 71, 73, 74, 72, 73],
  temperatureC: [36.6, 36.7, 36.5, 36.6, 36.7, 36.6, 36.7],
  bloodGlucose: [92, 95, 90, 94, 93, 91, 94],
  oxygenSat: [98, 98, 97, 98, 98, 98, 98],
  sleepHours: [7.2, 7.0, 7.4, 5.1, 4.4, 6.4, 6.8],
  sleepQuality: [4, 4, 4, 2, 2, 3, 4],
  moodScore: [4, 4, 4, 3, 3, 4, 4],
  stressScore: [2, 2, 2, 3, 3, 2, 2],
  teamStrain: [2, 2, 2, 2, 2, 2, 2],
  radiationRate: [17.8, 18.1, 17.9, 18.0, 18.0, 17.9, 18.0],
};

/** Hour of day for each series. */
export const SEED_TIMES: Partial<Record<MeasurementKey, number>> = {
  heartRate: 7,
  systolicBP: 7,
  diastolicBP: 7,
  temperatureC: 7,
  bloodGlucose: 7,
  oxygenSat: 7,
  sleepHours: 6.5,
  sleepQuality: 6.5,
  moodScore: 20,
  stressScore: 20,
  teamStrain: 20,
  radiationRate: 12,
};

const MANUAL_KEYS = new Set<MeasurementKey>(["sleepHours", "sleepQuality", "moodScore", "stressScore", "teamStrain"]);

/** Items already done on MD 142 (today). Everything else is open. */
const TODAY_DONE = new Set(["heart-rate", "blood-pressure", "temperature", "oxygen-sat", "blood-glucose", "sleep", "resistive"]);
/** Optional items that are part of the normal routine on earlier days. */
const PAST_OPTIONAL_DONE = new Set(["blood-glucose", "hydration"]);
/** Aerobic sessions skipped during the sleep slump. */
const AEROBIC_SKIPPED = new Set([139, 140]);

export interface SeedBundle {
  measurements: Omit<Measurement, "id">[];
  psych: Omit<PsychCheck, "id">[];
  radiation: Omit<RadiationReading, "id">[];
  workouts: Workout[];
  checklist: ChecklistItem[];
  inventory: InventoryItem[];
}

function at(md: number, hour: number): Date {
  const d = missionDayStart(md);
  d.setMinutes(Math.round(hour * 60));
  return d;
}

function seriesValue(key: MeasurementKey, md: number): number | undefined {
  return SEED_SERIES[key]?.[md - FIRST_SEED_DAY];
}

/** Pure: same `now` gives the same bundle. Rows later than `now` are dropped. */
export function buildSeed(now: Date): SeedBundle {
  const crewId = SIM_CREW.id;
  const b: SeedBundle = { measurements: [], psych: [], radiation: [], workouts: [], checklist: [], inventory: ACTIVE_INVENTORY };
  let cumulativeMgy = 0;

  for (let md = FIRST_SEED_DAY; md <= MISSION_DAY_TODAY; md++) {
    // Measurements
    for (const key of Object.keys(SEED_SERIES) as MeasurementKey[]) {
      const value = seriesValue(key, md);
      const t = at(md, SEED_TIMES[key] ?? 7);
      if (value === undefined || t > now) continue;
      b.measurements.push({
        crewId,
        key,
        value,
        unit: UNITS[key],
        source: MANUAL_KEYS.has(key) ? "manual" : "device-sim",
        takenAt: t.toISOString(),
      });
    }

    // Psych check at 20:00
    const psychAt = at(md, 20);
    if (psychAt <= now) {
      b.psych.push({
        crewId,
        at: psychAt.toISOString(),
        mood: seriesValue("moodScore", md)!,
        stress: seriesValue("stressScore", md)!,
        teamStrain: seriesValue("teamStrain", md)!,
        sleepQuality: seriesValue("sleepQuality", md)!,
      });
    }

    // Radiation at 12:00. Cumulative since log start, simulated.
    const rate = seriesValue("radiationRate", md)!;
    cumulativeMgy += (rate * 24) / 1000;
    const radAt = at(md, 12);
    if (radAt <= now) {
      b.radiation.push({
        crewId,
        at: radAt.toISOString(),
        rateUgyPerHour: rate,
        cumulativeMgy: Math.round(cumulativeMgy * 1000) / 1000,
        source: "simulatedCAD",
      });
    }

    // Workouts from the demonstration plan (not a NASA prescription).
    for (const plan of DEMO_WORKOUT_PLAN) {
      const t = at(md, plan.hour);
      if (t > now) continue;
      const skipped = plan.kind === "aerobic" && (AEROBIC_SKIPPED.has(md) || md === MISSION_DAY_TODAY);
      b.workouts.push({
        id: `wo-${md}-${plan.kind}`,
        crewId,
        at: t.toISOString(),
        kind: plan.kind,
        plannedMinutes: plan.plannedMinutes,
        minutes: skipped ? 0 : plan.plannedMinutes,
        completed: !skipped,
      });
    }

    // Checklist
    CHECKLIST_TEMPLATE.forEach((tpl, order) => {
      const item: ChecklistItem = {
        id: checklistItemId(md, tpl.slug),
        missionDay: String(md),
        label: tpl.label,
        kind: tpl.kind,
        required: tpl.required,
        linkedKey: tpl.linkedKey,
        note: tpl.note,
        sourceUrl: tpl.sourceUrl,
        order,
      };
      const doneAt = at(md, tpl.hour);
      const done =
        md === MISSION_DAY_TODAY
          ? TODAY_DONE.has(tpl.slug)
          : tpl.required
            ? !(tpl.slug === "aerobic" && AEROBIC_SKIPPED.has(md))
            : PAST_OPTIONAL_DONE.has(tpl.slug);
      if (done && doneAt <= now) {
        item.doneAt = doneAt.toISOString();
        if (tpl.linkedKey) item.value = seriesValue(tpl.linkedKey, md);
        if (tpl.linkedKey === "systolicBP") item.value2 = seriesValue("diastolicBP", md);
        if (tpl.slug === "dosimeter") item.value = seriesValue("radiationRate", md);
        const plan = DEMO_WORKOUT_PLAN.find((p) => p.kind === tpl.slug);
        if (plan) item.value = plan.plannedMinutes;
      }
      b.checklist.push(item);
    });
  }

  return b;
}

export async function resetDemoData(): Promise<void> {
  const now = new Date();
  const bundle = buildSeed(now);
  await store.resetAll();
  await Promise.all([
    putRaw("measurements", bundle.measurements.map((m) => ({ ...m, id: `m-seed-${missionDayOf(m.takenAt)}-${m.key}` }))),
    putRaw("psych", bundle.psych.map((p) => ({ ...p, id: `psy-seed-${missionDayOf(p.at)}` }))),
    putRaw("radiation", bundle.radiation.map((r) => ({ ...r, id: `rad-seed-${missionDayOf(r.at)}` }))),
    putRaw("workouts", bundle.workouts),
    putRaw("checklist", bundle.checklist),
  ]);
  await store.putInventory(bundle.inventory);
  await rebuildAlerts(SIM_CREW.id);
  await store.setMeta("seedVersion", SEED_VERSION);
  await store.setMeta("seededAt", now.toISOString());
}

export async function seedIfNeeded(): Promise<void> {
  if ((await store.getMeta("seedVersion")) !== SEED_VERSION) await resetDemoData();
}
