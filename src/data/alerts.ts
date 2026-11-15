import type { CrewId } from "../contracts";
import { replayAlerts } from "./anomaly";
import { id, putRaw, store } from "./store";

/** Clears a crew member's alerts and rebuilds them by replaying every measurement in time order. */
export async function rebuildAlerts(crewId: CrewId): Promise<void> {
  const rows = await store.listMeasurements(crewId);
  const { alerts, baselines } = replayAlerts(rows);
  await store.clearAlerts(crewId);
  await putRaw("alerts", alerts.map((a) => ({ ...a, id: id("al") })));
  await store.saveBaselines(baselines);
}
