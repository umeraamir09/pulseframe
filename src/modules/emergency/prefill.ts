import { SKELETON_REGIONS, type SkeletonRegionId } from "../../contracts/index.ts";

export interface EmergencyPrefill {
  situation: string;
  regionId?: SkeletonRegionId;
}

function isRegion(value: string | null): value is SkeletonRegionId {
  return value !== null && (SKELETON_REGIONS as readonly string[]).includes(value);
}

/** Link the assistant can open. Situation text and region are query params the intake form reads. */
export function emergencyHref(situation: string, regionId?: SkeletonRegionId): string {
  const params = new URLSearchParams();
  const text = situation.replace(/\s+/g, " ").trim().slice(0, 500);
  if (text) params.set("situation", text);
  if (regionId) params.set("region", regionId);
  const query = params.toString();
  return query ? `/emergency?${query}` : "/emergency";
}

/** Read `situation` and `region` from a search string (`a=b&c=d` or `?a=b`). */
export function readEmergencyQuery(search: string): EmergencyPrefill {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const situation = (params.get("situation") ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
  const region = params.get("region");
  return isRegion(region) ? { situation, regionId: region } : { situation };
}
