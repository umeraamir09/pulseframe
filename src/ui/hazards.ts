import { HRP_HAZARDS, type HazardId } from "../contracts";
import type { IconName } from "./Icon";

export const HAZARD_ICONS: Record<HazardId, IconName> = {
  radiation: "radiation",
  isolation: "lock",
  distance: "globe",
  gravity: "gravity",
  environment: "flask",
};

export function hazardLabel(id: HazardId): string {
  return HRP_HAZARDS.find((h) => h.id === id)?.label ?? id;
}
