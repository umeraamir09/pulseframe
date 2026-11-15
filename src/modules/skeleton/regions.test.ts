import { describe, expect, it } from "vitest";
import { SKELETON_REGIONS } from "../../contracts";
import { REGION_LABELS, isSkeletonRegionId, toggleRegion } from "./regions";

describe("skeleton regions", () => {
  it("labels every region", () => {
    for (const id of SKELETON_REGIONS) expect(REGION_LABELS[id]).toBeTruthy();
    expect(REGION_LABELS.skin).toBe("Skin (whole body)");
  });

  it("toggles a region on and off", () => {
    expect(toggleRegion([], "chest")).toEqual(["chest"]);
    expect(toggleRegion(["chest"], "chest")).toEqual([]);
  });

  it("supports multi-select in region order", () => {
    expect(toggleRegion(["leftLeg"], "head")).toEqual(["head", "leftLeg"]);
    expect(toggleRegion(["head", "chest", "skin"], "chest")).toEqual(["head", "skin"]);
  });

  it("recognises region ids from GLB userData", () => {
    expect(isSkeletonRegionId("rightArm")).toBe(true);
    expect(isSkeletonRegionId("tail")).toBe(false);
    expect(isSkeletonRegionId(undefined)).toBe(false);
  });
});
