import { useState } from "react";
import type { GroundReceipt, SyncPacket } from "../../contracts";
import {
  MISSION_DAY_TODAY,
  SIM_CREW,
  missionDayLabel,
  queueEmergencyCase,
  queueRoutineSummary,
  store,
  useLive,
  useSyncSettings,
} from "../../data/db";
import { Chip, type ChipTone } from "../../ui/Chip";
import { HazardChip } from "../../ui/HazardChip";

const DROP_RATES = [0, 0.3, 1] as const;

const STATUS_TONE: Record<SyncPacket["status"], ChipTone> = {
  queued: "neutral",
  sending: "watch",
  sent: "ok",
  failed: "act",
};

function shortId(id: string): string {
  return id.replace(/^pkt-/, "").slice(0, 8);
}

function time(iso?: string): string {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "–";
}

function kindLabel(kind: SyncPacket["kind"]): string {
  return kind === "emergency-case" ? "Emergency case" : "Routine summary";
}

function pretty(json: string): string {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

/** Dev-only helper until Dev A's emergency handoff lands: queues a simulated emergency case packet. */
async function queueDemoEmergency(): Promise<void> {
  const now = new Date().toISOString();
  const c = await store.saveCase({
    id: `case-demo-${crypto.randomUUID()}`,
    crewId: SIM_CREW.id,
    narrative: "Simulated emergency for sync testing",
    regionIds: ["chest"],
    startedAt: now,
    status: "monitoring",
    stage: "handoff",
  });
  await queueEmergencyCase(c.id);
}

function Outbox() {
  const { delaySec, linkUp, dropRate, set } = useSyncSettings();
  const { data } = useLive(() => store.listPackets(), []);
  const [busy, setBusy] = useState(false);
  const packets = [...(data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const waiting = packets.filter((p) => p.status !== "sent").length;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="sync-col">
      <h2>
        Station outbox <span className="count">{waiting}</span>
      </h2>

      <div className="sync-controls">
        <label className="delay">
          <span>
            Simulated one-way delay (demonstration): <strong>{delaySec} s</strong>
          </span>
          <input
            type="range"
            min={0}
            max={60}
            step={1}
            value={delaySec}
            onChange={(e) => set({ delaySec: Number(e.target.value) })}
          />
        </label>
        <label className="inline">
          <input type="checkbox" role="switch" checked={linkUp} onChange={(e) => set({ linkUp: e.target.checked })} />
          Link {linkUp ? <Chip tone="ok">up</Chip> : <Chip tone="act">down</Chip>}
        </label>
        <label className="inline">
          Drop rate
          <select value={dropRate} onChange={(e) => set({ dropRate: Number(e.target.value) })}>
            {DROP_RATES.map((r) => (
              <option key={r} value={r}>
                {r === 0 ? "0 (none)" : r === 1 ? "1 (all lost)" : r}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="row-actions start">
        <button type="button" className="primary" disabled={busy} onClick={() => void run(() => queueRoutineSummary())}>
          Queue today's summary
        </button>
        {import.meta.env.DEV ? (
          <button type="button" disabled={busy} onClick={() => void run(queueDemoEmergency)} title="Dev only">
            Simulate emergency packet (dev)
          </button>
        ) : null}
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Id</th>
              <th>Kind</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Retries</th>
              <th>Created</th>
              <th>Sent</th>
            </tr>
          </thead>
          <tbody>
            {packets.map((p) => (
              <tr key={p.id} className={p.priority === "emergency" ? "row-emergency" : ""}>
                <td>
                  <code>{shortId(p.id)}</code>
                </td>
                <td>{kindLabel(p.kind)}</td>
                <td>
                  <Chip tone={p.priority === "emergency" ? "act" : "neutral"}>{p.priority}</Chip>
                </td>
                <td>
                  <Chip tone={STATUS_TONE[p.status]}>{p.status}</Chip>
                  {p.status === "failed" && p.nextAttemptAt ? (
                    <span className="muted small"> retry {time(p.nextAttemptAt)}</span>
                  ) : null}
                </td>
                <td>{p.retryCount}</td>
                <td>{time(p.createdAt)}</td>
                <td>{time(p.sentAt)}</td>
              </tr>
            ))}
            {data && !packets.length ? (
              <tr>
                <td colSpan={7} className="muted">
                  Outbox empty. Queue a summary, or hand off an emergency case.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Emergency packets always go first. One packet is in flight at a time; failed sends retry after 2, 4, 8, 16, then
        every 30 seconds.
      </p>
    </section>
  );
}

function ReceiptRow({ r }: { r: GroundReceipt }) {
  return (
    <li className={`receipt${r.priority === "emergency" ? " emergency" : ""}`}>
      <div className="receipt-head">
        <Chip tone={r.priority === "emergency" ? "act" : "neutral"}>{r.priority}</Chip>
        <strong>{kindLabel(r.kind)}</strong>
        <code className="muted small">{shortId(r.id)}</code>
        <span className="muted small receipt-time">received {time(r.receivedAt)}</span>
        {r.checksumOk ? <Chip tone="ok">checksum OK</Chip> : <Chip tone="act">checksum mismatch</Chip>}
      </div>
      <details>
        <summary>Payload</summary>
        <pre>{pretty(r.payloadJson)}</pre>
      </details>
    </li>
  );
}

function GroundPortal() {
  const { data } = useLive(() => store.listGroundReceipts(), []);
  const receipts = [...(data ?? [])].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  return (
    <section className="sync-col ground">
      <h2>
        Ground Portal (simulated) <span className="count">{receipts.length}</span>
      </h2>
      <p className="muted small">What the flight surgeon on Earth receives. Deduplicated by packet id.</p>
      {data && !receipts.length ? <p className="muted">Nothing received yet.</p> : null}
      <ul className="receipts">
        {receipts.map((r) => (
          <ReceiptRow key={r.id} r={r} />
        ))}
      </ul>
    </section>
  );
}

export function SyncPage() {
  return (
    <section className="sync">
      <header className="page-head">
        <div>
          <h1>Ground sync</h1>
          <p className="muted">
            Store-and-forward to the flight surgeon · {SIM_CREW.displayName} (simulated) ·{" "}
            {missionDayLabel(MISSION_DAY_TODAY)}
          </p>
        </div>
        <HazardChip id="distance" />
      </header>
      <p className="intro">
        Far from Earth a live link can't be counted on, so data waits in the station outbox and is forwarded when the link
        allows. Delay and loss here are simulated for demonstration.
      </p>
      <div className="sync-grid">
        <Outbox />
        <GroundPortal />
      </div>
    </section>
  );
}
