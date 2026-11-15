import { describe, expect, it } from "vitest";
import { GENERAL_FALLBACK_ID, PROTOCOL_CARDS, getProtocol, matchProtocol } from "./index";

describe("matchProtocol", () => {
  it("matches the scripted chest narrative to the chest card", () => {
    const card = matchProtocol("Chest tightness after resistive exercise session", ["chest"]);
    expect(card.id).toBe("chest-tightness-post-exercise");
  });

  it("returns the general fallback when nothing matches", () => {
    expect(matchProtocol("headache", ["head"]).id).toBe(GENERAL_FALLBACK_ID);
    expect(matchProtocol("", []).id).toBe(GENERAL_FALLBACK_ID);
  });

  it("keeps candidate item ids empty and does not name a drug or a dose", () => {
    expect(getProtocol("chest-tightness-post-exercise")?.candidateItemIds).toEqual([]);
    expect(getProtocol(GENERAL_FALLBACK_ID)?.candidateItemIds).toEqual([]);
    const blob = JSON.stringify(PROTOCOL_CARDS).toLowerCase();
    expect(blob).not.toMatch(/\d+\s?(mg|mcg|µg|iu|ml)\b/);
    expect(blob).not.toMatch(/aspirin|ibuprofen|melatonin|acetaminophen|olopatadine|dose/);
  });
});
