import { SKELETON_REGIONS, type SkeletonRegionId } from "../../contracts";

export const REGION_LABELS: Record<SkeletonRegionId, string> = {
  head: "Head",
  chest: "Chest",
  abdomen: "Abdomen",
  spine: "Spine",
  leftArm: "Left arm",
  rightArm: "Right arm",
  leftLeg: "Left leg",
  rightLeg: "Right leg",
  skin: "Skin (whole body)",
};

/** Short pill labels for the pinpoint card. */
export const REGION_SHORT: Record<SkeletonRegionId, string> = {
  head: "Head",
  chest: "Chest",
  abdomen: "Abdomen",
  spine: "Spine",
  leftArm: "L arm",
  rightArm: "R arm",
  leftLeg: "L leg",
  rightLeg: "R leg",
  skin: "Skin",
};

export function isSkeletonRegionId(value: unknown): value is SkeletonRegionId {
  return typeof value === "string" && (SKELETON_REGIONS as readonly string[]).includes(value);
}

/** Adds `id` if missing, removes it if present. Keeps SKELETON_REGIONS order. */
export function toggleRegion(list: readonly SkeletonRegionId[], id: SkeletonRegionId): SkeletonRegionId[] {
  const next = list.includes(id) ? list.filter((r) => r !== id) : [...list, id];
  return SKELETON_REGIONS.filter((r) => next.includes(r));
}
