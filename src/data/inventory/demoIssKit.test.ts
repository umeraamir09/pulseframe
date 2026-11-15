import { describe, expect, it } from "vitest";
import { DEMO_ISS_KIT_SUBSET, NASA_ISS_KIT_PDF_URL } from "./demoIssKit";

describe("DEMO_ISS_KIT_SUBSET", () => {
  it("is a 3 to 5 item historical subset of the NASA checklist", () => {
    expect(DEMO_ISS_KIT_SUBSET.length).toBeGreaterThanOrEqual(3);
    expect(DEMO_ISS_KIT_SUBSET.length).toBeLessThanOrEqual(5);
    for (const item of DEMO_ISS_KIT_SUBSET) {
      expect(item.id).toMatch(/^kit-white-[a-z0-9-]+$/);
      expect(item.pack).toBe("Convenience Medication Pack (White)");
      expect(item.provenance).toBe("historical-demo-subset");
      expect(item.sourceUrl).toBe(NASA_ISS_KIT_PDF_URL);
      expect(item.sourcePage).toMatch(/^\d+$/);
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.strength.length).toBeGreaterThan(0);
      expect(item.route.length).toBeGreaterThan(0);
      expect(item.comments.length).toBeGreaterThan(0);
      expect(item.quantityOnBoard).toBeGreaterThan(0);
    }
  });

  it("keeps the transcribed checklist rows", () => {
    expect(DEMO_ISS_KIT_SUBSET.map((item) => [item.id, item.sourcePage, item.comments])).toEqual([
      [
        "kit-white-olopatadine",
        "2",
        "Remove contact lenses before use. After instilling drops, wait at least 10 minutes before inserting contact lenses.",
      ],
      ["kit-white-oxymetazoline", "3", "Do not use more than 3 consecutive days. Rebound congestion with prolonged use."],
      ["kit-white-hypromellose", "3", "Remove contact lenses prior to use."],
      ["kit-white-aspirin", "3", "Take with food."],
      ["kit-white-melatonin", "4", "Do not use with other sleep meds."],
    ]);
    expect(DEMO_ISS_KIT_SUBSET.find((item) => item.id === "kit-white-hypromellose")?.name).toBe(
      "Hypromellose (Nature\u2019s Tears)",
    );
    expect(DEMO_ISS_KIT_SUBSET.find((item) => item.id === "kit-white-aspirin")).toMatchObject({
      name: "Aspirin",
      strength: "325 mg",
      route: "Oral",
      quantityOnBoard: 60,
      location: "B4",
      sideEffects: "Upset stomach, dizziness, ringing in ears, blood in stool",
    });
  });
});
