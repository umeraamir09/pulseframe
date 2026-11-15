import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import type { SyncPacket } from "../contracts";
import { MISSION_DAY_TODAY, missionDayStart } from "./mission";
import { resetDemoData } from "./seed";
import { SIM_CREW, store } from "./store";
import {
  backoffSeconds,
  pickNext,
  queueEmergencyCase,
  queueRoutineSummary,
  requeueStuck,
  runSyncTick,
  sha256Hex,
  type SyncSettings,
} from "./sync";

const instant = async () => {};
const up: SyncSettings = { delaySec: 8, linkUp: true, dropRate: 0 };
const down: SyncSettings = { ...up, linkUp: false };

function t(sec: number): Date {
  const d = missionDayStart(MISSION_DAY_TODAY);
  d.setHours(21, 0, sec);
  return d;
}

async function tick(now: Date, settings: SyncSettings, wait = instant) {
  return runSyncTick(now, { settings: () => settings, wait, clock: () => now, random: () => 0.5 });
}

async function makeCase(): Promise<string> {
  await store.saveCase({
    id: "case-test",
    crewId: SIM_CREW.id,
    narrative: "Chest tightness after resistive exercise session",
    regionIds: ["chest"],
    startedAt: t(0).toISOString(),
    status: "open",
    stage: "handoff",
  });
  return "case-test";
}

describe("pure helpers", () => {
  it("backoff grows 2, 4, 8, 16 and caps at 30 seconds", () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(backoffSeconds)).toEqual([2, 4, 8, 16, 30, 30, 30]);
  });

  it("pickNext: emergency first, then oldest; failed only when due", () => {
    const base = { crewId: "c", destination: "earth-surgeon", kind: "routine-summary", payloadJson: "{}", checksum: "", retryCount: 0 } as const;
    const pkts: SyncPacket[] = [
      { ...base, id: "r1", createdAt: "2026-01-01T00:00:00Z", priority: "routine", status: "queued" },
      { ...base, id: "r0", createdAt: "2025-12-31T00:00:00Z", priority: "routine", status: "queued" },
      { ...base, id: "e1", createdAt: "2026-01-02T00:00:00Z", priority: "emergency", status: "queued" },
      { ...base, id: "f1", createdAt: "2020-01-01T00:00:00Z", priority: "emergency", status: "failed", nextAttemptAt: "2026-06-01T00:00:00Z" },
      { ...base, id: "s1", createdAt: "2020-01-01T00:00:00Z", priority: "emergency", status: "sent" },
    ];
    expect(pickNext(pkts, new Date("2026-03-01T00:00:00Z"))?.id).toBe("e1");
    expect(pickNext(pkts, new Date("2026-07-01T00:00:00Z"))?.id).toBe("f1");
    expect(pickNext(pkts.filter((p) => p.priority === "routine"), new Date("2026-03-01T00:00:00Z"))?.id).toBe("r0");
  });
});

describe("store-and-forward delivery", () => {
  beforeEach(async () => {
    await resetDemoData();
  });

  it("a routine summary goes queued -> sending -> sent and arrives with checksum OK", async () => {
    const pkt = await queueRoutineSummary(t(0));
    expect(pkt.status).toBe("queued");
    expect(pkt.checksum).toMatch(/^[0-9a-f]{64}$/);
    const payload = JSON.parse(pkt.payloadJson);
    expect(payload.measurements.every((m: { caseId?: string }) => !m.caseId)).toBe(true);

    let midFlight: string | undefined;
    const sent = await tick(t(1), up, async () => {
      midFlight = (await store.listPackets()).find((p) => p.id === pkt.id)?.status;
    });
    expect(midFlight).toBe("sending");
    expect(sent?.status).toBe("sent");
    const receipts = await store.listGroundReceipts();
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({ id: pkt.id, checksumOk: true, kind: "routine-summary" });
  });

  it("an emergency packet jumps ahead of queued routine packets", async () => {
    await queueRoutineSummary(t(0));
    await queueRoutineSummary(t(1));
    const emergency = await queueEmergencyCase(await makeCase());
    const first = await tick(t(2), up);
    expect(first?.id).toBe(emergency.id);
    expect(first?.priority).toBe("emergency");
    expect((await store.getCase("case-test"))?.packetId).toBe(emergency.id);
  });

  it("link down: fails with growing backoff, then delivers once when the link is back", async () => {
    const pkt = await queueRoutineSummary(t(0));

    const f1 = await tick(t(1), down);
    expect(f1).toMatchObject({ status: "failed", retryCount: 1, nextAttemptAt: t(3).toISOString() });

    expect(await tick(t(2), down)).toBeUndefined(); // not due yet

    const f2 = await tick(t(3), down);
    expect(f2).toMatchObject({ status: "failed", retryCount: 2, nextAttemptAt: t(7).toISOString() });

    const f3 = await tick(t(7), down);
    expect(f3).toMatchObject({ retryCount: 3, nextAttemptAt: t(15).toISOString() });

    const ok = await tick(t(15), up);
    expect(ok).toMatchObject({ id: pkt.id, status: "sent", retryCount: 3 });
    const receipts = await store.listGroundReceipts();
    expect(receipts.filter((r) => r.id === pkt.id)).toHaveLength(1);
  });

  it("a payload edited before arrival shows checksum mismatch", async () => {
    const pkt = await queueRoutineSummary(t(0));
    await tick(t(1), up, async () => {
      const p = (await store.listPackets()).find((x) => x.id === pkt.id)!;
      await store.savePacket({ ...p, payloadJson: p.payloadJson.replace(/^\{/, '{"tampered":true,') });
    });
    const [r] = await store.listGroundReceipts();
    expect(r.checksumOk).toBe(false);
  });

  it("a drop (random below dropRate) counts as a failure", async () => {
    await queueRoutineSummary(t(0));
    const res = await runSyncTick(t(1), {
      settings: () => ({ ...up, dropRate: 1 }),
      wait: instant,
      clock: () => t(1),
      random: () => 0.2,
    });
    expect(res?.status).toBe("failed");
  });

  it("packets stuck in sending after a reload go back to queued and deliver", async () => {
    const pkt = await queueRoutineSummary(t(0));
    await store.savePacket({ ...pkt, status: "sending", sentAt: t(0).toISOString() });
    expect(await requeueStuck()).toBe(1);
    expect((await store.listPackets())[0].status).toBe("queued");
    expect((await tick(t(1), up))?.status).toBe("sent");
  });

  it("checksum is SHA-256 of the payload JSON", async () => {
    const pkt = await queueRoutineSummary(t(0));
    expect(await sha256Hex(pkt.payloadJson)).toBe(pkt.checksum);
  });
});
