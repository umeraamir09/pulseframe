import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PacketPriority, SyncPacket } from "../contracts";
import { missionDayOf } from "./mission";
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
  const packet = await queuePacket({
    priority: "emergency",
    kind: "emergency-case",
    destination: "earth-surgeon",
    payload: { case: c, steps, measurements, alerts, recommendations, medAdmins },
  });
  await store.saveCase({ ...c, packetId: packet.id });
  return packet;
}

// ---------------------------------------------------------------------------
// Delivery: a simulated store-and-forward link (PF-11, issue 13).
// Demonstration values, not real light-time delays. Not a DTN stack.

export interface SyncSettings {
  /** Simulated one-way delay in seconds (demonstration). */
  delaySec: number;
  linkUp: boolean;
  /** Probability a send is lost in transit, 0 to 1. */
  dropRate: number;
}

export const DEFAULT_SYNC_SETTINGS: SyncSettings = { delaySec: 8, linkUp: true, dropRate: 0 };

type SyncSettingsState = SyncSettings & { set: (p: Partial<SyncSettings>) => void };

export const useSyncSettings = create<SyncSettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SYNC_SETTINGS,
      set: (p) => set(p),
    }),
    {
      name: "pf-sync",
      partialize: ({ delaySec, linkUp, dropRate }) => ({ delaySec, linkUp, dropRate }),
    },
  ),
);

export const MAX_BACKOFF_SEC = 30;

/** Seconds to wait before retrying a packet that has already failed `retryCount` times: 2, 4, 8, 16, 30, 30... */
export function backoffSeconds(retryCount: number): number {
  return Math.min(2 ** retryCount * 2, MAX_BACKOFF_SEC);
}

const PRIORITY_RANK: Record<PacketPriority, number> = { emergency: 0, routine: 1 };

/** The next packet to send: queued, or failed and due for retry. Emergency first, then oldest. */
export function pickNext(packets: SyncPacket[], now: Date): SyncPacket | undefined {
  const t = now.toISOString();
  return packets
    .filter((p) => p.status === "queued" || (p.status === "failed" && (!p.nextAttemptAt || p.nextAttemptAt <= t)))
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.createdAt.localeCompare(b.createdAt))[0];
}

export interface TickOptions {
  /** Read at send time and again on arrival, so flipping the link mid-flight counts. */
  settings?: () => SyncSettings;
  wait?: (ms: number) => Promise<void>;
  random?: () => number;
  clock?: () => Date;
}

const defaultWait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
let inFlight = false;

/** One step of the loop. Sends at most one packet and resolves when it has arrived or failed. */
export async function runSyncTick(now = new Date(), opts: TickOptions = {}): Promise<SyncPacket | undefined> {
  if (inFlight) return undefined;
  inFlight = true;
  try {
    const settings = opts.settings ?? (() => useSyncSettings.getState());
    const clock = opts.clock ?? (() => new Date());
    const next = pickNext(await store.listPackets(), now);
    if (!next) return undefined;

    await store.savePacket({ ...next, status: "sending", sentAt: now.toISOString(), nextAttemptAt: undefined });
    await (opts.wait ?? defaultWait)(Math.max(0, settings().delaySec) * 1000);

    // Re-read: the row may have been edited (or reset) while in flight.
    const packet = (await store.listPackets()).find((p) => p.id === next.id);
    if (!packet || packet.status !== "sending") return packet;
    const arrivedAt = clock();
    const { linkUp, dropRate } = settings();

    if (!linkUp || (opts.random ?? Math.random)() < dropRate) {
      return store.savePacket({
        ...packet,
        status: "failed",
        retryCount: packet.retryCount + 1,
        nextAttemptAt: new Date(arrivedAt.getTime() + backoffSeconds(packet.retryCount) * 1000).toISOString(),
      });
    }

    const receivedAt = arrivedAt.toISOString();
    // put by id: a retried packet overwrites its receipt instead of duplicating it.
    await store.saveGroundReceipt({
      id: packet.id,
      receivedAt,
      checksumOk: (await sha256Hex(packet.payloadJson)) === packet.checksum,
      priority: packet.priority,
      kind: packet.kind,
      payloadJson: packet.payloadJson,
    });
    return store.savePacket({ ...packet, status: "sent", receivedAt });
  } finally {
    inFlight = false;
  }
}

let loopStarted = false;

/** Starts the 1-second delivery loop once. Packets stuck in "sending" (e.g. after a reload) go back to "queued". */
export function startSyncLoop(): void {
  if (loopStarted || typeof window === "undefined") return;
  loopStarted = true;
  void (async () => {
    await requeueStuck();
    setInterval(() => void runSyncTick(), 1000);
  })();
}

/** Puts packets left in "sending" (the tab closed mid-flight) back in the queue. Returns how many. */
export async function requeueStuck(): Promise<number> {
  let n = 0;
  for (const p of await store.listPackets()) {
    if (p.status === "sending") {
      await store.savePacket({ ...p, status: "queued" });
      n++;
    }
  }
  return n;
}

/** Routine packet: last 24 h of measurements (no case rows), open alerts, today's checklist, last psych check, today's workouts. */
export async function queueRoutineSummary(now = new Date()): Promise<SyncPacket> {
  const crewId = SIM_CREW.id;
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const md = missionDayOf(now.toISOString());
  const [measurements, alerts, checklist, psych, workouts] = await Promise.all([
    store.listMeasurements(crewId, since),
    store.listAlerts(crewId),
    store.listChecklist(String(md)),
    store.listPsych(crewId),
    store.listWorkouts(crewId),
  ]);
  const required = checklist.filter((i) => i.required);
  const lastPsych = psych.at(-1);
  return queuePacket({
    priority: "routine",
    kind: "routine-summary",
    destination: "earth-surgeon",
    payload: {
      crewId,
      missionDay: md,
      generatedAt: now.toISOString(),
      measurements: measurements.filter((m) => !m.caseId),
      openAlerts: alerts.filter((a) => !a.ackedAt),
      checklist: { requiredDone: required.filter((i) => i.doneAt).length, required: required.length },
      // The PsychCheck only carries a note when the crew chose to share it.
      lastPsych: lastPsych ?? null,
      workouts: workouts.filter((w) => missionDayOf(w.at) === md),
    },
  });
}
