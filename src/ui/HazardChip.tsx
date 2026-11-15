import { HRP_HAZARDS_URL, type HazardId } from "../contracts";
import { HAZARD_ICONS, hazardLabel } from "./hazards";
import { Icon } from "./Icon";

/** NASA HRP hazard label. Links to the public hazards page. */
export function HazardChip({ id, white }: { id: HazardId; white?: boolean }) {
  return (
    <a className={`hazard-chip${white ? " white" : ""}`} href={HRP_HAZARDS_URL} target="_blank" rel="noreferrer">
      <span className="hz-badge">
        <Icon name={HAZARD_ICONS[id]} size={14} />
      </span>
      {hazardLabel(id)}
    </a>
  );
}
