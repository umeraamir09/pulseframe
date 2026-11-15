import { useEffect, useState } from "react";
import type { GroundReceipt, SyncPacket } from "../../contracts";
import {
  SIM_CREW,
  missionDayLabel,
  missionDayOf,
  queueEmergencyCase,
  queueRoutineSummary,
  store,
  useLive,
  useSyncSettings,
} from "../../data/db";
import { Segmented } from "../../ui/controls";
import { HazardChip } from "../../ui/HazardChip";
import { Icon, type IconName } from "../../ui/Icon";
import { usePageMeta } from "../../ui/pageMeta";

const DROP_RATES = [0, 0.3, 1] as const;

function kb(json: string): string {
  const bytes = new TextEncoder().encode(json).length;
  return bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`;
}

function pretty(json: string): string {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

/** Human name for a packet, read from its payload. */
function packetName(kind: SyncPacket["kind"], payloadJson: string, createdAt: string): { name: string; icon: IconName } {
  try {
    const p = JSON.parse(payloadJson) as { missionDay?: number; case?: { narrative?: string } };
    if (kind === "emergency-case") return { name: "Case handoff", icon: "send" };
    return { name: `Daily record ${missionDayLabel(p.missionDay ?? missionDayOf(createdAt))}`, icon: "inbox" };
  } catch {
    return { name: kind === "emergency-case" ? "Case handoff" : "Routine summary", icon: kind === "emergency-case" ? "send" : "inbox" };
  }
}

/** Dev-only helper: queues a simulated emergency case packet without walking the emergency flow. */
async function queueDemoEmergency(): Promise<void> {
  const now = new Date().toISOString();
  const c = await store.saveCase({
    id: `case-demo-${crypto.randomUUID()}`,
    crewId: SIM_CREW.id,
    narrative: "Simulated emergency for sync testing",
    regionIds: ["chest"],
    startedAt: now,
    status: "closed",
    closedAt: now,
    stage: "handoff",
  });
  await queueEmergencyCase(c.id);
}

function StatusChip({ p, onRetry }: { p: SyncPacket; onRetry: () => void }) {
  switch (p.status) {
    case "sending":
      return (
        <span className="tag accent">
          <Icon name="upload" size={14} /> Sending
        </span>
      );
    case "queued":
      return (
        <span className="tag">
          <Icon name="clock" size={14} /> Queued
        </span>
      );
    case "sent":
      return (
        <span className="tag normal">
          <Icon name="check" size={14} /> Sent
        </span>
      );
    case "failed":
      return (
        <span className="row">
          <span className="tag act">
            <span className="dot act" /> Failed
          </span>
          <button type="button" className="icon-round" style={{ width: 36, height: 36, background: "var(--surface2)" }} onClick={onRetry} aria-label="Retry now">
            <Icon name="refresh" size={16} />
          </button>
        </span>
      );
  }
}

async function retry(p: SyncPacket) {
  await store.savePacket({ ...p, status: "queued", nextAttemptAt: undefined });
}

function Outbox() {
  const { delaySec, linkUp, dropRate, set } = useSyncSettings();
  const { data } = useLive(() => store.listPackets(), []);
  const [busy, setBusy] = useState(false);
  const packets = [...(data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const failed = packets.filter((p) => p.status === "failed");

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card pad-lg outbox" aria-labelledby="outbox-title">
      <div className="card-head">
        <div className="titles">
          <p className="overline">Station</p>
          <h2 id="outbox-title" className="h2">
            Outbox
          </h2>
        </div>
        <span className="tag">
          <Icon name="satellite" size={14} /> Simulated link
        </span>
      </div>

      <div className="sync-controls">
        <Segmented
          label="Link"
          value={linkUp ? "up" : "down"}
          onChange={(v) => set({ linkUp: v === "up" })}
          className="on-surface2"
          options={[
            {
              value: "up",
              label: (
                <>
                  <Icon name="signal" size={16} /> Link up
                </>
              ),
            },
            { value: "down", label: "Link down" },
          ]}
        />
        <label className="range">
          <span className="row small">
            <span className="muted">Delay</span>
            <strong style={{ fontSize: 15 }}>{delaySec} s one way</strong>
            <span className="faint">(demonstration)</span>
          </span>
          <input type="range" min={0} max={60} step={1} value={delaySec} onChange={(e) => set({ delaySec: Number(e.target.value) })} />
        </label>
        <label className="row small">
          <span className="muted">Loss</span>
          <select className="select" value={dropRate} onChange={(e) => set({ dropRate: Number(e.target.value) })}>
            {DROP_RATES.map((r) => (
              <option key={r} value={r}>
                {r === 0 ? "None" : r === 1 ? "All lost" : `${r * 100}%`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <h3 className="muted" style={{ fontSize: 14, fontWeight: 500 }}>
        Queue
      </h3>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Packet</th>
              <th>Priority</th>
              <th>Size</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {packets.map((p) => {
              const { name, icon } = packetName(p.kind, p.payloadJson, p.createdAt);
              const high = p.priority === "emergency";
              return (
                <tr key={p.id}>
                  <td>
                    <span className="pkt-name">
                      <span style={{ color: high ? "var(--act)" : "var(--muted)" }}>
                        <Icon name={icon} size={18} />
                      </span>
                      {name}
                    </span>
                  </td>
                  <td>{high ? <span className="tag act">High</span> : <span className="tag">Normal</span>}</td>
                  <td>{kb(p.payloadJson)}</td>
                  <td>
                    <StatusChip p={p} onRetry={() => void retry(p)} />
                    {p.status === "failed" && p.retryCount ? <span className="faint small"> try {p.retryCount + 1}</span> : null}
                  </td>
                </tr>
              );
            })}
            {data && !packets.length ? (
              <tr>
                <td colSpan={4} className="muted">
                  Outbox empty. Queue a summary, or hand off an emergency case.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="note">
        <Icon name="lock" size={16} /> Private psych notes are never queued. Emergency packets always go first.
      </p>

      <span style={{ flex: 1 }} />
      <div className="row wrap">
        <button
          type="button"
          className="btn secondary"
          disabled={busy || !failed.length}
          onClick={() => void run(() => Promise.all(failed.map(retry)))}
        >
          <Icon name="refresh" size={18} /> Retry failed
        </button>
        <button type="button" className="btn primary" disabled={busy} onClick={() => void run(() => queueRoutineSummary())}>
          <Icon name="send" size={18} /> Queue today's summary
        </button>
        {import.meta.env.DEV ? (
          <button type="button" className="btn ghost sm" disabled={busy} onClick={() => void run(queueDemoEmergency)} title="Dev only">
            Simulate emergency packet (dev)
          </button>
        ) : null}
      </div>
    </section>
  );
}

function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function InTransit({ p, delaySec }: { p: SyncPacket; delaySec: number }) {
  const now = useNow();
  const { name, icon } = packetName(p.kind, p.payloadJson, p.createdAt);
  const left = p.sentAt ? Math.max(0, Math.ceil((Date.parse(p.sentAt) + delaySec * 1000 - now) / 1000)) : delaySec;
  return (
    <li className="receipt">
      <span className="icon-badge sq accent">
        <Icon name={icon} size={18} />
      </span>
      <div className="grow">
        <div style={{ fontWeight: 500 }}>{name}</div>
        <div className="meta">{p.priority === "emergency" ? "High priority" : "Normal priority"} · in transit</div>
        <span className="tag accent" style={{ marginTop: 8 }}>
          <Icon name="clock" size={14} /> Arriving in about {left} s
        </span>
      </div>
    </li>
  );
}

function ReceiptRow({ r }: { r: GroundReceipt }) {
  const { name, icon } = packetName(r.kind, r.payloadJson, r.receivedAt);
  return (
    <li className="receipt">
      <span className={`icon-badge sq ${r.priority === "emergency" ? "act" : "accent"}`}>
        <Icon name={icon} size={18} />
      </span>
      <div className="grow">
        <div style={{ fontWeight: 500 }}>{name}</div>
        <div className="meta">
          Received {new Date(r.receivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} ·{" "}
          {kb(r.payloadJson)}
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          {r.checksumOk ? (
            <span className="tag normal">
              <Icon name="check" size={14} /> Checksum OK
            </span>
          ) : (
            <span className="tag act">Checksum mismatch</span>
          )}
        </div>
        <details>
          <summary className="small" style={{ color: "var(--accent)", cursor: "pointer", marginTop: 8 }}>
            Payload
          </summary>
          <pre>{pretty(r.payloadJson)}</pre>
        </details>
      </div>
    </li>
  );
}

function GroundPortal() {
  const { delaySec } = useSyncSettings();
  const { data } = useLive(() => store.listGroundReceipts(), []);
  const { data: packets } = useLive(() => store.listPackets(), []);
  const receipts = [...(data ?? [])].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const sending = (packets ?? []).filter((p) => p.status === "sending");
  return (
    <section className="card pad-lg dark ground on-dark" aria-labelledby="ground-title">
      <div className="titles">
        <p className="overline">Ground</p>
        <h2 id="ground-title" className="h2">
          Ground portal
        </h2>
      </div>
      <p className="sub">What the flight surgeon sees after the delay. Deduplicated by packet id.</p>
      <ul className="stack">
        {sending.map((p) => (
          <InTransit key={p.id} p={p} delaySec={delaySec} />
        ))}
        {receipts.map((r) => (
          <ReceiptRow key={r.id} r={r} />
        ))}
      </ul>
      {data && !receipts.length && !sending.length ? <p className="sub">Nothing received yet.</p> : null}
      <div>
        <HazardChip id="distance" />
      </div>
    </section>
  );
}

export function SyncPage() {
  usePageMeta("Earth sync", "Store and forward, simulated link");
  return (
    <div className="sync-grid">
      <Outbox />
      <GroundPortal />
    </div>
  );
}
