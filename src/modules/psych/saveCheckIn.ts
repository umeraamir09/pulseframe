import { UNITS, type Alert, type MeasurementKey, type PsychCheck } from "../../contracts";
import { MISSION_DAY_TODAY, SIM_CREW, store } from "../../data/db";

export type PsychField = "mood" | "stress" | "teamStrain" | "sleepQuality";

export const PSYCH_KEYS: Record<PsychField, MeasurementKey> = {
  mood: "moodScore",
  stress: "stressScore",
  teamStrain: "teamStrain",
  sleepQuality: "sleepQuality",
};

export interface CheckInInput extends Record<PsychField, number> {
  note?: string;
  includeNote: boolean;
}

/**
 * Saves one check-in: a PsychCheck, four scored measurements, and ticks today's checklist item.
 * A private note is kept in meta under `psychNote:<id>` and never on the PsychCheck that sync packets read.
 */
export async function saveCheckIn(input: CheckInInput, at = new Date().toISOString()): Promise<{ check: PsychCheck; alerts: Alert[] }> {
  const note = input.note?.trim();
  const check = await store.addPsych({
    crewId: SIM_CREW.id,
    at,
    mood: input.mood,
    stress: input.stress,
    teamStrain: input.teamStrain,
    sleepQuality: input.sleepQuality,
    note: input.includeNote && note ? note : undefined,
  });
  if (!input.includeNote && note) await store.setMeta(`psychNote:${check.id}`, note);

  const alerts: Alert[] = [];
  for (const field of Object.keys(PSYCH_KEYS) as PsychField[]) {
    const key = PSYCH_KEYS[field];
    const { alert } = await store.recordMeasurement({
      crewId: SIM_CREW.id,
      key,
      value: input[field],
      unit: UNITS[key],
      source: "manual",
      takenAt: at,
    });
    if (alert) alerts.push(alert);
  }

  const item = (await store.listChecklist(String(MISSION_DAY_TODAY))).find((i) => i.kind === "psych");
  if (item && !item.doneAt) await store.saveChecklistItem({ ...item, doneAt: at });

  return { check, alerts };
}
