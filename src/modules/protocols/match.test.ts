import { describe, expect, it } from "vitest";
import type { SkeletonRegionId } from "../../contracts";
import { MEASUREMENT_KEYS } from "../../contracts";
import { RESEARCHER_KIT } from "../../data/inventory/researcherKit";
import { GENERAL_FALLBACK_ID, PROTOCOL_CARDS, getProtocol, matchProtocol } from "./index";

const RESEARCH_CARD_IDS = [
  "choking-airway",
  "bleeding-laceration-abrasion",
  "fire-smoke-burns",
  "eye-foreign-body-abrasion",
  "headache-co2",
  "space-motion-sickness",
];

describe("PROTOCOL_CARDS", () => {
  it("registers the team cards and the six research cards with the fallback last", () => {
    expect(PROTOCOL_CARDS.map((card) => card.id).sort()).toEqual(
      ["chest-tightness-post-exercise", GENERAL_FALLBACK_ID, ...RESEARCH_CARD_IDS].sort(),
    );
    expect(PROTOCOL_CARDS[PROTOCOL_CARDS.length - 1]!.id).toBe(GENERAL_FALLBACK_ID);
    expect(new Set(PROTOCOL_CARDS.map((card) => card.id)).size).toBe(PROTOCOL_CARDS.length);
  });

  it("keeps every research card sourced, flagged safety and with red flags", () => {
    for (const id of RESEARCH_CARD_IDS) {
      const card = getProtocol(id)!;
      expect(card.safety).toBe(true);
      expect(card.redFlagsLifeThreat?.length).toBeGreaterThan(0);
      expect(card.redFlagsCallGround?.length).toBeGreaterThan(0);
      expect(card.sources?.length).toBeGreaterThan(0);
      const sourceIds = new Set(card.sources!.map((source) => source.id));
      const cited = [
        ...card.immediateSteps.flatMap((step) => step.sourceIds ?? []),
        ...(card.timeLimits ?? []).flatMap((limit) => limit.sourceIds),
        ...(card.whenGroundUnavailable?.sourceIds ?? []),
      ];
      for (const sourceId of cited) expect(sourceIds, `${id} cites ${sourceId}`).toContain(sourceId);
    }
  });

  it("uses only shared measurement keys and leaves the rest as proposed keys", () => {
    for (const card of PROTOCOL_CARDS) {
      for (const test of card.tests) {
        if (test.inputKey) expect(MEASUREMENT_KEYS).toContain(test.inputKey);
      }
      for (const proposed of card.proposedKeys ?? []) {
        expect(MEASUREMENT_KEYS as readonly string[]).not.toContain(proposed.key);
      }
    }
  });

  it("names only candidate items that are in the researcher kit", () => {
    const kitIds = new Set(RESEARCHER_KIT.map((item) => item.id));
    for (const card of PROTOCOL_CARDS) {
      for (const itemId of card.candidateItemIds) expect(kitIds, `${card.id} -> ${itemId}`).toContain(itemId);
    }
  });

  it("does not state a dose amount on any card", () => {
    const blob = JSON.stringify(PROTOCOL_CARDS).toLowerCase();
    expect(blob).not.toMatch(/\d+(\.\d+)?\s?(mg|mcg|µg|iu|ml|tablets?|capsules?|puffs?)\b/);
  });

  it("keeps the team cards free of kit items and drug names", () => {
    expect(getProtocol("chest-tightness-post-exercise")?.candidateItemIds).toEqual([]);
    expect(getProtocol(GENERAL_FALLBACK_ID)?.candidateItemIds).toEqual([]);
    const teamBlob = JSON.stringify([getProtocol("chest-tightness-post-exercise"), getProtocol(GENERAL_FALLBACK_ID)]);
    expect(teamBlob.toLowerCase()).not.toMatch(/aspirin|ibuprofen|melatonin|acetaminophen|olopatadine|dose/);
  });
});

describe("matchProtocol", () => {
  it("matches the scripted chest narrative to the chest card", () => {
    const card = matchProtocol("Chest tightness after resistive exercise session", ["chest"]);
    expect(card.id).toBe("chest-tightness-post-exercise");
  });

  const typical: [string, SkeletonRegionId[], string][] = [
    ["Crewmate is choking on food, cannot speak, lips turning blue", ["head", "chest"], "choking-airway"],
    ["Deep cut on the forearm from a sharp edge, bleeding and floating blood droplets", ["leftArm"], "bleeding-laceration-abrasion"],
    ["Smoke in the module, burned hand on a hot panel, coughing after smoke", ["skin", "rightArm"], "fire-smoke-burns"],
    ["Debris in my eye, it feels gritty and keeps tearing", ["head"], "eye-foreign-body-abrasion"],
    ["Bad headache and foggy, cabin CO2 might be high", ["head"], "headache-co2"],
    ["Nausea and vomiting since launch, dizzy and no appetite in the first days", ["abdomen"], "space-motion-sickness"],
  ];

  it.each(typical)("matches %j", (narrative, regions, expected) => {
    expect(matchProtocol(narrative, regions).id).toBe(expected);
  });

  it("returns the general fallback when no keyword matches", () => {
    expect(matchProtocol("feeling odd", ["head"]).id).toBe(GENERAL_FALLBACK_ID);
    expect(matchProtocol("", []).id).toBe(GENERAL_FALLBACK_ID);
    expect(matchProtocol("", ["leftLeg"]).id).toBe(GENERAL_FALLBACK_ID);
  });

  it("matches keywords at the start of a word only", () => {
    // "hot" inside "shot" and "cut" inside "acute" must not pick a card.
    expect(matchProtocol("took a photo shot, acute boredom", []).id).toBe(GENERAL_FALLBACK_ID);
  });
});
