import { describe, expect, it } from "vitest";
import { ACTION_MAX_WORDS, HEADLINE_MAX_WORDS, crewPlain, hasMedicationDose } from "./briefCopy";

describe("crewPlain", () => {
  it("keeps a short plain headline", () => {
    expect(crewPlain("15 above your normal", HEADLINE_MAX_WORDS)).toBe("15 above your normal");
  });

  it("drops z-scores, Greek letters and em dashes, and stops at 8 words", () => {
    const messy = "Heart rate spiked to 78 bpm (z = 5.23), far above your μ — call soon extra words";
    const plain = crewPlain(messy, HEADLINE_MAX_WORDS);
    expect(plain.split(/\s+/)).toHaveLength(HEADLINE_MAX_WORDS);
    expect(plain).toBe("Heart rate spiked to 78 bpm, far above");
    expect(plain).not.toMatch(/[—–μσ]|\bz\b/);
  });

  it("removes a z-score word and citation markers", () => {
    expect(crewPlain("Short sleep, z-score -3.1 [base:sleephours].", HEADLINE_MAX_WORDS)).toBe("Short sleep.");
  });

  it("clips an action to one line", () => {
    const action = crewPlain("Tell the flight surgeon before the next sleep period and log it again tonight please", ACTION_MAX_WORDS);
    expect(action.split(/\s+/).length).toBeLessThanOrEqual(ACTION_MAX_WORDS);
    expect(action.startsWith("Tell the flight surgeon")).toBe(true);
  });
});

describe("hasMedicationDose", () => {
  it("catches a medicine amount and lets a glucose reading through", () => {
    expect(hasMedicationDose("Take 500 mg now")).toBe(true);
    expect(hasMedicationDose("2 tablets at bedtime")).toBe(true);
    expect(hasMedicationDose("Glucose is 94 mg/dL")).toBe(false);
    expect(hasMedicationDose("15 above your normal")).toBe(false);
  });
});
