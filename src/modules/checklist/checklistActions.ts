import { UNITS, type Alert, type ChecklistItem, type MeasurementKey, type WorkoutKind } from "../../contracts";
import { DEMO_WORKOUT_PLAN, SIM_CREW, missionDayOf, missionDayStart, store } from "../../data/db";
import { saveReading } from "../radiation/saveReading";

/** The template slug, e.g. "chk-142-heart-rate" -> "heart-rate". */
export function slugOf(item: ChecklistItem): string {
  return item.id.split("-").slice(2).join("-");
}

/** Items without a measurement key that still take a number inline. */
const VALUE_UNITS: Record<string, string> = {
  resistive: "min",
  aerobic: "min",
  dosimeter: "µGy/h",
  hydration: "L",
};

/** Unit for the inline value pill, or undefined when the row is a plain check. */
export function unitFor(item: ChecklistItem): string | undefined {
  return item.linkedKey ? UNITS[item.linkedKey] : VALUE_UNITS[slugOf(item)];
}

/** A timestamp on the item's mission day at the current time of day (never in the future). */
export function stampFor(missionDay: string): string {
  const now = new Date();
  const d = missionDayStart(Number(missionDay));
  d.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
  return (d > now ? now : d).toISOString();
}

async function recordVital(key: MeasurementKey, value: number, takenAt: string): Promise<Alert | undefined> {
  const { alert } = await store.recordMeasurement({
    crewId: SIM_CREW.id,
    key,
    value,
    unit: UNITS[key],
    source: "checklist",
    takenAt,
  });
  return alert;
}

/** Updates the day's planned workout of this kind, or adds one, so the fitness tracker stays in step. */
async function logWorkout(kind: WorkoutKind, minutes: number, at: string): Promise<void> {
  const md = missionDayOf(at);
  const rows = (await store.listWorkouts(SIM_CREW.id)).filter((w) => w.kind === kind && missionDayOf(w.at) === md);
  const planned = rows.find((w) => w.plannedMinutes !== undefined);
  if (planned) {
    await store.saveWorkout({ ...planned, minutes, completed: true });
    return;
  }
  const plan = DEMO_WORKOUT_PLAN.find((p) => p.kind === kind);
  await store.saveWorkout({
    id: plan ? `wo-${md}-${kind}` : `wk-${crypto.randomUUID()}`,
    crewId: SIM_CREW.id,
    at,
    kind,
    plannedMinutes: plan?.plannedMinutes,
    minutes,
    completed: true,
  });
}

/**
 * Saves an inline value for a checklist row and marks it done.
 * Vitals become scored measurements; exercise updates the workout log; the dosimeter goes through the
 * radiation log; water intake is kept on the checklist item only.
 */
export async function saveItemValue(item: ChecklistItem, value: number, value2?: number): Promise<Alert[]> {
  if (!Number.isFinite(value) || value < 0 || (value2 !== undefined && (!Number.isFinite(value2) || value2 < 0))) {
    throw new Error("Enter a positive number.");
  }
  const at = stampFor(item.missionDay);
  const slug = slugOf(item);
  const alerts: Alert[] = [];

  if (item.linkedKey) {
    const a = await recordVital(item.linkedKey, value, at);
    if (a) alerts.push(a);
    if (item.linkedKey === "systolicBP" && value2 !== undefined) {
      const b = await recordVital("diastolicBP", value2, at);
      if (b) alerts.push(b);
    }
  } else if (slug === "resistive" || slug === "aerobic") {
    await logWorkout(slug, value, at);
  } else if (slug === "dosimeter") {
    const { alert } = await saveReading(value, at);
    if (alert) alerts.push(alert);
  }

  // Re-read: saveReading may already have ticked this item.
  const latest = (await store.listChecklist(item.missionDay)).find((i) => i.id === item.id) ?? item;
  await store.saveChecklistItem({ ...latest, value, value2, doneAt: at });
  return alerts;
}
