import { UNITS, type Alert, type RadiationReading } from "../../contracts";
import { MISSION_DAY_TODAY, SIM_CREW, store } from "../../data/db";

export const MAX_RATE_UGY_PER_HOUR = 10_000;

/** Cumulative dose after the last reading, integrating the new rate over the hours since it. */
export function nextCumulative(last: RadiationReading | undefined, rateUgyPerHour: number, at: string): number {
  if (!last) return 0;
  const hours = Math.max(0, (Date.parse(at) - Date.parse(last.at)) / 3_600_000);
  return Math.round((last.cumulativeMgy + (rateUgyPerHour * hours) / 1000) * 1000) / 1000;
}

/**
 * Logs a manual dosimeter reading: a RadiationReading with the running cumulative dose, plus a
 * radiationRate measurement that the anomaly engine scores. Ticks today's "Read personal dosimeter" item.
 */
export async function saveReading(
  rateUgyPerHour: number,
  at = new Date().toISOString(),
): Promise<{ reading: RadiationReading; alert?: Alert }> {
  if (!Number.isFinite(rateUgyPerHour) || rateUgyPerHour < 0 || rateUgyPerHour > MAX_RATE_UGY_PER_HOUR) {
    throw new Error(`Enter a dose rate between 0 and ${MAX_RATE_UGY_PER_HOUR} µGy/h.`);
  }
  const history = await store.listRadiation(SIM_CREW.id);
  const last = history.filter((r) => r.at <= at).at(-1);
  const reading = await store.addRadiation({
    crewId: SIM_CREW.id,
    at,
    cumulativeMgy: nextCumulative(last, rateUgyPerHour, at),
    rateUgyPerHour,
    source: "manual",
  });
  const { alert } = await store.recordMeasurement({
    crewId: SIM_CREW.id,
    key: "radiationRate",
    value: rateUgyPerHour,
    unit: UNITS.radiationRate,
    source: "manual",
    takenAt: at,
  });

  const item = (await store.listChecklist(String(MISSION_DAY_TODAY))).find((i) => i.kind === "radiation");
  if (item && !item.doneAt) await store.saveChecklistItem({ ...item, doneAt: at, value: rateUgyPerHour });

  return { reading, alert };
}
