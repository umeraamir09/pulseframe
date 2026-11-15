import type { EmergencyStage } from "../../contracts";

/** The eight stages on the progress strip. Monitoring sits after Send. */
export const FLOW: { stage: EmergencyStage; label: string }[] = [
  { stage: "intake", label: "Situation" },
  { stage: "pinpoint", label: "Pinpoint" },
  { stage: "current-info", label: "Check" },
  { stage: "differential", label: "Differential" },
  { stage: "tests", label: "Tests" },
  { stage: "immediate", label: "Steps" },
  { stage: "kit", label: "Kit" },
  { stage: "handoff", label: "Send" },
];

const ORDER: EmergencyStage[] = [...FLOW.map((step) => step.stage), "monitoring"];

/** A missing case is the intake form, so closing a case starts the next visit there. */
export function visibleStage(open: { stage: EmergencyStage } | undefined): EmergencyStage {
  return open?.stage ?? "intake";
}

/** Index on the strip. Monitoring is past the last step, so every step reads as done. */
export function stageIndex(stage: EmergencyStage): number {
  const index = ORDER.indexOf(stage);
  return index < 0 ? 0 : index;
}

export function nextStage(stage: EmergencyStage): EmergencyStage | undefined {
  const index = ORDER.indexOf(stage);
  if (index < 0 || index >= ORDER.length - 1) return undefined;
  return ORDER[index + 1];
}

export function canRetreat(stage: EmergencyStage, protocolId?: string): boolean {
  if (protocolId) return false;
  return stage === "pinpoint" || stage === "current-info";
}
