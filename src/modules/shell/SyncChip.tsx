import { Link } from "react-router-dom";
import { Icon } from "../../ui/Icon";
import { usePendingPackets } from "./usePendingPackets";

/** Earth-sync status in the station header. */
export function SyncChip({ short }: { short?: boolean }) {
  const { loaded, pending } = usePendingPackets();
  const n = pending.length;
  const label = !loaded ? "Earth sync" : n > 0 ? `${short ? "" : "Earth sync: "}${n} queued` : short ? "All sent" : "Earth sync: all sent";
  return (
    <Link to="/sync" className="head-chip" aria-live="polite">
      <Icon name="satellite" size={18} className="icon-accent" />
      {label}
      <span className={`dot ${n > 0 ? "watch" : "normal"}`} aria-hidden="true" />
    </Link>
  );
}

/** Live count of packets waiting to reach Earth, shown in the side nav. */
export function NavSyncCount() {
  const { pending, emergency } = usePendingPackets();
  if (!pending.length) return null;
  return (
    <span
      className={`nav-count${emergency ? " emergency" : ""}`}
      aria-label={`${pending.length} packet${pending.length > 1 ? "s" : ""} waiting${emergency ? ", including emergency" : ""}`}
    >
      {pending.length}
    </span>
  );
}
