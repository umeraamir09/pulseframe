import { describe, expect, it } from "vitest";
import type { Baseline, ProtocolStep } from "../../contracts";
import { PROTOCOL_CARDS } from "../protocols";
import { STAGES, buildSteps, scoreAgainst, stageIndex } from "./useEmergencyCase";

describe("emergency stages", () => {
  it("orders the eight strip stages and puts monitoring after send", () => {
    expect(STAGES.map((s) => s.label)).toEqual(["Situation", "Pinpoint", "Check", "Differential", "Tests", "Steps", "Kit", "Send"]);
    expect(stageIndex("intake")).toBe(0);
    expect(stageIndex("handoff")).toBe(7);
    expect(stageIndex("monitoring")).toBe(8);
  });

  it("builds tests first, then immediate actions, in order", () => {
    const card = PROTOCOL_CARDS[0]!;
    const steps = buildSteps("case-1", card);
    expect(steps).toHaveLength(card.tests.length + card.immediateSteps.length);
    expect(steps.map((s) => s.order)).toEqual(steps.map((_, i) => i));
    expect(steps.slice(0, card.tests.length).every((s) => s.kind === "test")).toBe(true);
    expect(steps.slice(card.tests.length).every((s) => s.kind === "action" && !s.inputKey)).toBe(true);
  });
});

describe("scoreAgainst", () => {
  const baseline: Baseline = { crewId: "c", key: "heartRate", windowDays: 7, mean: 65.43, std: 6.106, updatedAt: "" };
  const step = (resultValue?: number): ProtocolStep => ({
    id: "s",
    caseId: "case-1",
    kind: "test",
    title: "Heart rate",
    instruction: "",
    inputKey: "heartRate",
    completed: resultValue !== undefined,
    resultValue,
    order: 0,
  });

  it("reads a result against the personal baseline with the same z thresholds", () => {
    const a = scoreAgainst(step(96), [baseline]);
    expect(a?.severity).toBe("act");
    expect(a?.zScore).toBeCloseTo(5.01, 2);
    expect(scoreAgainst(step(79), [baseline])?.severity).toBe("watch");
    expect(scoreAgainst(step(68), [baseline])).toBeUndefined();
  });

  it("returns nothing without a result or a baseline", () => {
    expect(scoreAgainst(step(), [baseline])).toBeUndefined();
    expect(scoreAgainst(step(96), [])).toBeUndefined();
  });
});
