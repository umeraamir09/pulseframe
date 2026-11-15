import { describe, expect, it } from "vitest";
import { DEMO_ISS_KIT_SUBSET } from "../../data/inventory/demoIssKit";
import { validateRecommendation } from "./validate";

const realId = DEMO_ISS_KIT_SUBSET[0]!.id;

describe("validateRecommendation", () => {
  it("keeps a real id and rejects kit-fake-x", () => {
    const result = validateRecommendation(
      { itemIds: ["kit-fake-x", realId], rationale: "", cautions: "" },
      DEMO_ISS_KIT_SUBSET,
      "case-1",
      true,
    );
    expect(result.error).toBeUndefined();
    expect(result.rejectedItemIds).toEqual(["kit-fake-x"]);
    expect(result.recommendation?.itemIds).toEqual([realId]);
    expect(result.recommendation?.needsSurgeonReview).toBe(true);
    expect(result.recommendation?.offlineFallback).toBe(true);
    expect(result.recommendation?.caseId).toBe("case-1");
  });

  it("returns the same id for the same kept draft", () => {
    const draft = { itemIds: [realId, realId, "kit-fake-x"], rationale: "From protocol card", cautions: "Review" };
    const a = validateRecommendation(draft, DEMO_ISS_KIT_SUBSET, "case-1", true);
    const b = validateRecommendation(draft, DEMO_ISS_KIT_SUBSET, "case-1", false);
    expect(a.recommendation?.id).toBe(b.recommendation?.id);
    expect(a.recommendation?.itemIds).toEqual([realId]);
    expect(b.recommendation?.offlineFallback).toBe(false);
  });

  it("rejects a draft that is not the schema", () => {
    const result = validateRecommendation({ itemIds: ["kit-fake-x"], rationale: "" }, DEMO_ISS_KIT_SUBSET, "case-1", false);
    expect(result.recommendation).toBeUndefined();
    expect(result.rejectedItemIds).toEqual([]);
    expect(result.error).toBeTruthy();
  });
});
