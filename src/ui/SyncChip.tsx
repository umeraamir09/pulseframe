import { store, useLive } from "../data/db";

/** Live count of packets waiting to reach Earth (queued, sending or failed). Rendered in the shell nav. */
export function SyncChip() {
  const { data } = useLive(() => store.listPackets(), []);
  const pending = (data ?? []).filter((p) => p.status !== "sent");
  if (!pending.length) return null;
  const emergency = pending.some((p) => p.priority === "emergency");
  return (
    <span
      className={`nav-count${emergency ? " emergency" : ""}`}
      aria-label={`${pending.length} packet${pending.length > 1 ? "s" : ""} waiting${emergency ? ", including emergency" : ""}`}
    >
      {pending.length}
    </span>
  );
}
