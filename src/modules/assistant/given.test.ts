import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { DEMO_ISS_KIT_SUBSET } from "../../data/inventory/demoIssKit";
import { SIM_CREW, store } from "../../data/store";
import { canLogGiven } from "./copy";

describe("canLogGiven", () => {
  const ready = {
    doseText: "as the flight surgeon said on the loop",
    confirmedBy: "Crew A (simulated)",
    surgeonApproved: true,
  };

  it("requires dose text, confirmer, and the surgeon checkbox", () => {
    expect(canLogGiven(ready)).toBe(true);
    expect(canLogGiven({ ...ready, doseText: "   " })).toBe(false);
    expect(canLogGiven({ ...ready, confirmedBy: "" })).toBe(false);
    expect(canLogGiven({ ...ready, surgeonApproved: false })).toBe(false);
  });
});

describe("recordMedicationAdmin", () => {
  it("writes one medAdmins row with the text the crew typed", async () => {
    const item = DEMO_ISS_KIT_SUBSET[0]!;
    const typed = "as the flight surgeon said on the loop";
    const row = await store.recordMedicationAdmin({
      crewId: SIM_CREW.id,
      itemId: item.id,
      caseId: "case-1",
      doseText: typed,
      givenAt: "2026-11-15T12:00:00.000Z",
      confirmedBy: "Crew A (simulated)",
    });
    const saved = (await store.listMedicationAdmins(SIM_CREW.id)).filter((admin) => admin.id === row.id);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ itemId: item.id, doseText: typed, confirmedBy: "Crew A (simulated)", caseId: "case-1" });
  });
});
