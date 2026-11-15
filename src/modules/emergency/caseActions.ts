import {
  UNITS,
  type EmergencyCase,
  type EmergencyStage,
  type Measurement,
  type MeasurementKey,
  type ProtocolStep,
  type SkeletonRegionId,
} from "../../contracts";
import { SIM_CREW, id, queueEmergencyCase, store } from "../../data/db";
import { getProtocol, matchProtocol, type ProtocolCard } from "../protocols";

/** Writes run one at a time so a fast second click cannot overwrite the first. */
let chain: Promise<void> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "Could not save. Try again.";
}

export function emergencyMeasurement(
  crewId: string,
  caseId: string,
  key: MeasurementKey,
  value: number,
  takenAt = new Date().toISOString(),
): Omit<Measurement, "id"> {
  return {
    crewId,
    key,
    value,
    unit: UNITS[key],
    source: "emergency-test",
    takenAt,
    caseId,
  };
}

export function recordCaseMeasurement(caseId: string, key: MeasurementKey, value: number) {
  return store.recordMeasurement(emergencyMeasurement(SIM_CREW.id, caseId, key, value));
}

function stepsFor(caseId: string, card: ProtocolCard): ProtocolStep[] {
  const tests: ProtocolStep[] = card.tests.map((test, index) => ({
    id: id("step"),
    caseId,
    kind: "test",
    title: test.title,
    instruction: test.instruction,
    ...(test.inputKey ? { inputKey: test.inputKey } : {}),
    completed: false,
    order: index,
  }));
  const actions: ProtocolStep[] = card.immediateSteps.map((step, index) => ({
    id: id("step"),
    caseId,
    kind: "action",
    title: step.title,
    instruction: step.instruction,
    completed: false,
    order: tests.length + index,
  }));
  return [...tests, ...actions];
}

function appendSkip(instruction: string, reason: string): string {
  const suffix = ` — Skipped: ${reason.trim()}`;
  return instruction.includes(suffix) ? instruction : `${instruction}${suffix}`;
}

/** Opens a case, or updates the narrative while the crew is still on intake. */
export function startCase(narrative: string): Promise<EmergencyCase> {
  const text = narrative.trim();
  if (!text) return Promise.reject(new Error("Describe what is happening before starting the case."));
  return enqueue(async () => {
    const existing = await store.getOpenCase(SIM_CREW.id);
    if (!existing) {
      return store.saveCase({
        id: id("case"),
        crewId: SIM_CREW.id,
        narrative: text,
        regionIds: [],
        startedAt: new Date().toISOString(),
        status: "open",
        stage: "pinpoint",
      });
    }
    if (existing.stage !== "intake") return existing;
    return store.saveCase({ ...existing, narrative: text, stage: "pinpoint" });
  });
}

export function setRegions(regionIds: SkeletonRegionId[]): Promise<EmergencyCase | undefined> {
  return enqueue(async () => {
    const current = await store.getOpenCase(SIM_CREW.id);
    if (!current || current.stage !== "pinpoint") return current;
    return store.saveCase({ ...current, regionIds });
  });
}

export function advance(
  stage: EmergencyStage,
  patch?: Partial<Pick<EmergencyCase, "currentInfoSnapshot">>,
): Promise<EmergencyCase | undefined> {
  return enqueue(async () => {
    const current = await store.getOpenCase(SIM_CREW.id);
    if (!current) return undefined;
    let next: EmergencyCase = { ...current, ...patch, stage };
    if (stage === "differential") {
      const card = (next.protocolId ? getProtocol(next.protocolId) : undefined) ?? matchProtocol(next.narrative, next.regionIds);
      next = { ...next, protocolId: card.id };
      await store.saveCase(next);
      const existing = await store.listSteps(next.id);
      if (existing.length === 0) await store.saveSteps(stepsFor(next.id, card));
      return next;
    }
    return store.saveCase(next);
  });
}

export function retreat(): Promise<EmergencyCase | undefined> {
  return enqueue(async () => {
    const current = await store.getOpenCase(SIM_CREW.id);
    if (!current || current.protocolId) return current;
    const early: EmergencyStage[] = ["intake", "pinpoint", "current-info"];
    const index = early.indexOf(current.stage);
    if (index <= 0) return current;
    return store.saveCase({ ...current, stage: early[index - 1]! });
  });
}

export function completeStep(
  stepId: string,
  patch?: { resultValue?: number; measurementId?: string; instructionSuffix?: string },
): Promise<void> {
  return enqueue(async () => {
    const current = await store.getOpenCase(SIM_CREW.id);
    if (!current) return;
    const steps = await store.listSteps(current.id);
    const now = new Date().toISOString();
    await store.saveSteps(
      steps.map((step) => {
        if (step.id !== stepId) return step;
        const instruction = patch?.instructionSuffix ? appendSkip(step.instruction, patch.instructionSuffix) : step.instruction;
        return {
          ...step,
          instruction,
          completed: true,
          completedAt: step.completedAt ?? now,
          resultValue: patch?.resultValue ?? step.resultValue,
          measurementId: patch?.measurementId ?? step.measurementId,
        };
      }),
    );
  });
}

/** Marks every unfinished action step done and stores the reason on its instruction. */
export function skipRemainingActions(reason: string): Promise<void> {
  const text = reason.trim();
  if (!text) return Promise.resolve();
  return enqueue(async () => {
    const current = await store.getOpenCase(SIM_CREW.id);
    if (!current) return;
    const steps = await store.listSteps(current.id);
    const now = new Date().toISOString();
    await store.saveSteps(
      steps.map((step) => {
        if (step.kind !== "action" || step.completed) return step;
        return { ...step, completed: true, completedAt: now, instruction: appendSkip(step.instruction, text) };
      }),
    );
  });
}

export function handoffCase(caseId: string): Promise<EmergencyCase> {
  return enqueue(async () => {
    const current = await store.getCase(caseId);
    if (!current) throw new Error("Case not found");
    if (current.packetId && current.status === "monitoring") return current;
    const packet = current.packetId
      ? (await store.listPackets()).find((row) => row.id === current.packetId)
      : await queueEmergencyCase(caseId);
    if (!packet) throw new Error("Emergency packet was not created");
    const latest = await store.getCase(caseId);
    if (!latest) throw new Error("Case not found");
    return store.saveCase({ ...latest, packetId: packet.id, status: "monitoring", stage: "monitoring" });
  });
}

export function closeCase(): Promise<EmergencyCase | undefined> {
  return enqueue(async () => {
    const current = await store.getOpenCase(SIM_CREW.id);
    if (!current) return undefined;
    return store.saveCase({ ...current, status: "closed", closedAt: new Date().toISOString() });
  });
}
