import { openDB, type IDBPDatabase } from "idb";
import type {
  Alert,
  Baseline,
  ChecklistItem,
  CrewId,
  CrewProfile,
  EmergencyCase,
  GroundReceipt,
  InventoryItem,
  IsoDateTime,
  Measurement,
  MedicationAdmin,
  ProtocolStep,
  PsychCheck,
  PulseframeStore,
  RadiationReading,
  Recommendation,
  SyncPacket,
  Workout,
} from "../contracts";
import { notify, subscribeStore } from "./live";

const DB_NAME = "pulseframe";
const DB_VERSION = 2;

export const STORE_NAMES = [
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
  "steps",
  "recommendations",
  "medAdmins",
  "groundInbox",
  "meta",
] as const;

export type StoreName = (typeof STORE_NAMES)[number];

export const SIM_CREW: CrewProfile = {
  id: "crew-sim-01",
  displayName: "Simulated Crew Member A",
  role: "Crew",
  simulated: true,
};

let dbp: Promise<IDBPDatabase> | undefined;

export function connect(): Promise<IDBPDatabase> {
  return (dbp ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      for (const name of STORE_NAMES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: "id" });
        }
      }
    },
  }));
}

export function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function all<T>(name: StoreName): Promise<T[]> {
  const db = await connect();
  return (await db.getAll(name)) as T[];
}

async function put<T>(name: StoreName, row: T): Promise<T> {
  const db = await connect();
  await db.put(name, row);
  notify();
  return row;
}

/** Bulk write in one transaction with a single notify. Used by the seed; skips anomaly scoring. */
export async function putRaw<T>(name: StoreName, rows: T[]): Promise<void> {
  if (!rows.length) return;
  const db = await connect();
  const tx = db.transaction(name, "readwrite");
  await Promise.all([...rows.map((r) => tx.store.put(r)), tx.done]);
  notify();
}

const byTime =
  <T>(field: (row: T) => string) =>
  (a: T, b: T) =>
    field(a) < field(b) ? -1 : field(a) > field(b) ? 1 : 0;

function forCrewSince<T extends { crewId: CrewId }>(
  rows: T[],
  crewId: CrewId,
  at: (row: T) => string,
  from?: IsoDateTime,
  to?: IsoDateTime,
): T[] {
  return rows
    .filter((r) => r.crewId === crewId && (!from || at(r) >= from) && (!to || at(r) <= to))
    .sort(byTime(at));
}

export const store: PulseframeStore = {
  async getCrew() {
    return SIM_CREW;
  },

  async listMeasurements(crewId, from, to) {
    return forCrewSince(await all<Measurement>("measurements"), crewId, (m) => m.takenAt, from, to);
  },
  async addMeasurement(m) {
    return (await store.recordMeasurement(m)).measurement;
  },
  async recordMeasurement(m) {
    // Anomaly scoring is wired in by PF-6 (issue 8).
    const measurement = await put<Measurement>("measurements", { ...m, id: id("m") });
    return { measurement };
  },

  async listAlerts(crewId) {
    return (await all<Alert>("alerts")).filter((a) => a.crewId === crewId).sort(byTime((a) => a.openedAt));
  },
  async saveAlert(a) {
    return put("alerts", a);
  },
  async ackAlert(alertId, at) {
    const db = await connect();
    const a = (await db.get("alerts", alertId)) as Alert | undefined;
    if (!a) return undefined;
    return put<Alert>("alerts", { ...a, ackedAt: at ?? new Date().toISOString() });
  },
  async clearAlerts(crewId) {
    const db = await connect();
    const tx = db.transaction("alerts", "readwrite");
    for (const a of (await tx.store.getAll()) as Alert[]) {
      if (a.crewId === crewId) await tx.store.delete(a.id);
    }
    await tx.done;
    notify();
  },

  async getBaselines(crewId) {
    return (await all<Baseline & { id: string }>("baselines")).filter((b) => b.crewId === crewId);
  },
  async saveBaselines(b) {
    await putRaw(
      "baselines",
      b.map((x) => ({ ...x, id: `${x.crewId}:${x.key}` })),
    );
  },

  async listInventory() {
    return all<InventoryItem>("inventory");
  },
  async putInventory(items) {
    await putRaw("inventory", items);
  },

  async saveCase(c) {
    return put("cases", c);
  },
  async getCase(caseId) {
    const db = await connect();
    return (await db.get("cases", caseId)) as EmergencyCase | undefined;
  },
  async listCases(crewId) {
    return forCrewSince(await all<EmergencyCase>("cases"), crewId, (c) => c.startedAt);
  },
  async getOpenCase(crewId) {
    const cases = await store.listCases(crewId);
    return cases.reverse().find((c) => c.status !== "closed");
  },

  async listSteps(caseId) {
    return (await all<ProtocolStep>("steps")).filter((s) => s.caseId === caseId).sort((a, b) => a.order - b.order);
  },
  async saveSteps(steps) {
    await putRaw("steps", steps);
  },

  async saveRecommendation(r) {
    return put("recommendations", r);
  },
  async listRecommendations(caseId) {
    return (await all<Recommendation>("recommendations"))
      .filter((r) => r.caseId === caseId)
      .sort(byTime((r) => r.createdAt));
  },

  async recordMedicationAdmin(a) {
    return put<MedicationAdmin>("medAdmins", { ...a, id: id("med") });
  },
  async listMedicationAdmins(crewId, from) {
    return forCrewSince(await all<MedicationAdmin>("medAdmins"), crewId, (a) => a.givenAt, from);
  },

  async listChecklist(missionDay) {
    return (await all<ChecklistItem>("checklist"))
      .filter((i) => i.missionDay === missionDay)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  },
  async saveChecklistItem(i) {
    return put("checklist", i);
  },

  async listWorkouts(crewId, from) {
    return forCrewSince(await all<Workout>("workouts"), crewId, (w) => w.at, from);
  },
  async saveWorkout(w) {
    return put("workouts", w);
  },

  async listRadiation(crewId, from) {
    return forCrewSince(await all<RadiationReading>("radiation"), crewId, (r) => r.at, from);
  },
  async addRadiation(r) {
    return put<RadiationReading>("radiation", { ...r, id: id("rad") });
  },

  async listPsych(crewId, from) {
    return forCrewSince(await all<PsychCheck>("psych"), crewId, (p) => p.at, from);
  },
  async addPsych(p) {
    return put<PsychCheck>("psych", { ...p, id: id("psy") });
  },

  async listPackets() {
    return (await all<SyncPacket>("packets")).sort(byTime((p) => p.createdAt));
  },
  async savePacket(p) {
    return put("packets", p);
  },
  async listGroundReceipts() {
    return (await all<GroundReceipt>("groundInbox")).sort(byTime((r) => r.receivedAt));
  },
  async saveGroundReceipt(r) {
    await put("groundInbox", r);
  },

  async getMeta(key) {
    const db = await connect();
    const row = (await db.get("meta", key)) as { id: string; value: unknown } | undefined;
    return row?.value;
  },
  async setMeta(key, value) {
    await put("meta", { id: key, value });
  },
  async resetAll() {
    const db = await connect();
    const tx = db.transaction([...STORE_NAMES], "readwrite");
    await Promise.all([...STORE_NAMES.map((n) => tx.objectStore(n).clear()), tx.done]);
    notify();
  },
  subscribe(listener) {
    return subscribeStore(listener);
  },
};
