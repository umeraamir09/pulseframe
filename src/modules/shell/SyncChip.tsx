import { store, useLive } from "../../data/db";

/**
 * Earth-sync status in the station header.
 * Counts packets that have not reached Earth yet (queued, sending, or failed).
 */
export function SyncChip() {
  const { data } = useLive(() => store.listPackets(), []);
  const pending = (data ?? []).filter((packet) => packet.status !== "sent").length;
  const tone = data === undefined ? "idle" : pending > 0 ? "queued" : "sent";
  const label =
    tone === "idle"
      ? "Earth sync: idle"
      : tone === "queued"
        ? `Earth sync: ${pending} queued`
        : "Earth sync: all sent";

  return (
    <span className={`sync-chip sync-chip-${tone}`} aria-live="polite">
      <span className="chip-icon" aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M12 3.5 13.1 8 17.5 9.2 13.1 10.4 12 14.8 10.9 10.4 6.5 9.2 10.9 8 12 3.5z" />
          <path d="M18 14.5 18.6 16.4 20.5 17 18.6 17.6 18 19.5 17.4 17.6 15.5 17 17.4 16.4 18 14.5z" />
        </svg>
      </span>
      {label}
      <span className="sync-dot" aria-hidden="true" />
    </span>
  );
}
