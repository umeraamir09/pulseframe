import { store, useLive } from "../../data/db";

/** Packets that have not reached Earth yet: queued, sending or failed. */
export function usePendingPackets() {
  const { data } = useLive(() => store.listPackets(), []);
  const pending = (data ?? []).filter((packet) => packet.status !== "sent");
  return { loaded: data !== undefined, pending, emergency: pending.some((p) => p.priority === "emergency") };
}
