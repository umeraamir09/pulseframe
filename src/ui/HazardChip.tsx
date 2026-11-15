import { HRP_HAZARDS, HRP_HAZARDS_URL, type HazardId } from "../contracts";

/** NASA HRP hazard label. Links to the public hazards page. */
export function HazardChip({ id }: { id: HazardId }) {
  const hazard = HRP_HAZARDS.find((item) => item.id === id);
  if (!hazard) return null;
  return (
    <a className="hazard-chip" href={HRP_HAZARDS_URL} target="_blank" rel="noreferrer">
      {hazard.label}
    </a>
  );
}
