import { SKELETON_REGIONS, type Alert, type MeasurementKey, type SkeletonRegionId } from "../../contracts";

/** Open vital alerts light a region on the body. Sleep and the self-report scales do not. */
const ALERT_REGION: Partial<Record<MeasurementKey, SkeletonRegionId>> = {
  heartRate: "chest",
  systolicBP: "chest",
  diastolicBP: "chest",
  oxygenSat: "chest",
  temperatureC: "skin",
};

export function regionsWithOpenAlerts(alerts: readonly Alert[]): SkeletonRegionId[] {
  const hit = new Set<SkeletonRegionId>();
  for (const alert of alerts) {
    if (alert.ackedAt) continue;
    const region = ALERT_REGION[alert.key];
    if (region) hit.add(region);
  }
  return SKELETON_REGIONS.filter((region) => hit.has(region));
}
