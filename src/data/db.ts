import { openDB, type IDBPDatabase } from "idb";
import type { PulseframeStore, CrewProfile, Measurement, Alert, Baseline, InventoryItem, EmergencyCase } from "../contracts";

const DB_NAME = "pulseframe";
const DB_VERSION = 1;

const SIM_CREW: CrewProfile = {
  id: "crew-sim-01",
  displayName: "Simulated Crew Member A",
  role: "Crew",
  simulated: true,
};

async function connect(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      for (const name of [
        "measurements",
        "alerts",
        "baselines",
        "inventory",
        "cases",
        "workouts",
        "radiation",
        "psych",
        "checklist",
        "packets",
      ]) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: "id" });
        }
      }
    },
  });
}

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

/** IndexedDB-backed store. Dev B should extend this; Dev A should import only from contracts + this module. */
export const store: PulseframeStore = {
  async getCrew() {
    return SIM_CREW;
  },
  async listMeasurements(crewId, from, to) {
    const db = await connect();
    const all = (await db.getAll("measurements")) as Measurement[];
    return all.filter((m) => {
      if (m.crewId !== crewId) return false;
      if (from && m.takenAt < from) return false;
      if (to && m.takenAt > to) return false;
      return true;
    });
  },
  async addMeasurement(m) {
    const db = await connect();
    const row: Measurement = { ...m, id: id("m") };
    await db.put("measurements", row);
    return row;
  },
  async listAlerts(crewId) {
    const db = await connect();
    const all = (await db.getAll("alerts")) as Alert[];
    return all.filter((a) => a.crewId === crewId);
  },
  async getBaselines(crewId) {
    const db = await connect();
    const all = (await db.getAll("baselines")) as Baseline[];
    return all.filter((b) => b.crewId === crewId);
  },
  async listInventory() {
    const db = await connect();
    return (await db.getAll("inventory")) as InventoryItem[];
  },
  async saveCase(c) {
    const db = await connect();
    await db.put("cases", c);
    return c;
  },
  async getOpenCase(crewId) {
    const db = await connect();
    const all = (await db.getAll("cases")) as EmergencyCase[];
    return all.find((c) => c.crewId === crewId && c.status !== "closed");
  },
};

export { SIM_CREW, connect, id };
