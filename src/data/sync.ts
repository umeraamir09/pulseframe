import type { PacketPriority, SyncPacket } from "../contracts";
import { SIM_CREW, id, store } from "./store";

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface QueuePacketInput {
  priority: PacketPriority;
  kind: SyncPacket["kind"];
  destination: SyncPacket["destination"];
  payload: unknown;
}

export async function queuePacket(input: QueuePacketInput): Promise<SyncPacket> {
  const payloadJson = JSON.stringify(input.payload);
  return store.savePacket({
    id: id("pkt"),
    crewId: SIM_CREW.id,
    createdAt: new Date().toISOString(),
    priority: input.priority,
    kind: input.kind,
    destination: input.destination,
    payloadJson,
    checksum: await sha256Hex(payloadJson),
    status: "queued",
    retryCount: 0,
  });
}

/** Collects everything tied to an emergency case into one emergency packet. */
export async function queueEmergencyCase(caseId: string): Promise<SyncPacket> {
  const c = await store.getCase(caseId);
  if (!c) throw new Error(`Unknown case ${caseId}`);
  const [steps, measurements, alerts, recommendations, medAdmins] = await Promise.all([
    store.listSteps(caseId),
    store.listMeasurements(c.crewId).then((rows) => rows.filter((m) => m.caseId === caseId)),
    store.listAlerts(c.crewId).then((rows) => rows.filter((a) => a.caseId === caseId || a.openedAt >= c.startedAt)),
    store.listRecommendations(caseId),
    store.listMedicationAdmins(c.crewId, c.startedAt),
  ]);
  return queuePacket({
    priority: "emergency",
    kind: "emergency-case",
    destination: "earth-surgeon",
    payload: { case: c, steps, measurements, alerts, recommendations, medAdmins },
  });
}

/** Store-and-forward loop. Implemented in PF-11 (issue 13). */
export function startSyncLoop(): void {}
