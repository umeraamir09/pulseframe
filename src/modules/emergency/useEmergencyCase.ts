import type { Alert, Baseline, EmergencyCase, EmergencyStage, ProtocolStep, SkeletonRegionId } from "../../contracts";
import { SIM_CREW, Z_ACT, Z_WATCH, id, queueEmergencyCase, store, useLive } from "../../data/db";
import { getProtocol, matchProtocol, type ProtocolCard } from "../protocols";

/** The eight steps on the progress strip. Monitoring comes after Send. */
export const STAGES: { id: EmergencyStage; label: string }[] = [
  { id: "intake", label: "Situation" },
  { id: "pinpoint", label: "Pinpoint" },
  { id: "current-info", label: "Check" },
  { id: "differential", label: "Differential" },
  { id: "tests", label: "Tests" },
  { id: "immediate", label: "Steps" },
  { id: "kit", label: "Kit" },
  { id: "handoff", label: "Send" },
];

export function stageIndex(stage: EmergencyStage): number {
  if (stage === "monitoring") return STAGES.length;
  return STAGES.findIndex((s) => s.id === stage);
}

/** Intake details that have no field on EmergencyCase. Kept on station in meta under `caseIntake:<caseId>`. */
export interface CaseIntake {
  quickPick?: string;
  started?: string;
  strength?: number;
}

export const intakeKey = (caseId: string) => `caseIntake:${caseId}`;

/** Builds the ordered ProtocolStep rows for a case: tests first, then immediate actions. */
export function buildSteps(caseId: string, card: ProtocolCard): ProtocolStep[] {
  const tests: ProtocolStep[] = card.tests.map((t, i) => ({
    id: `${caseId}-test-${i}`,
    caseId,
    kind: "test",
    title: t.title,
    instruction: t.instruction,
    inputKey: t.inputKey,
    completed: false,
    order: i,
  }));
  const actions: ProtocolStep[] = card.immediateSteps.map((s, i) => ({
    id: `${caseId}-action-${i}`,
    caseId,
    kind: "action",
    title: s.title,
    instruction: s.instruction,
    completed: false,
    order: tests.length + i,
  }));
  return [...tests, ...actions];
}

/**
 * When the store raised no new alert for a test result (one open alert per metric and day is kept),
 * score it against the stored personal baseline with the same z rule so the result still reads Act or Watch.
 */
export function scoreAgainst(step: ProtocolStep, baselines: Baseline[]): Alert | undefined {
  if (!step.inputKey || step.resultValue === undefined) return undefined;
  const b = baselines.find((x) => x.key === step.inputKey);
  if (!b || !(b.std > 0)) return undefined;
  const z = (step.resultValue - b.mean) / b.std;
  if (Math.abs(z) < Z_WATCH) return undefined;
  const severity: Alert["severity"] = Math.abs(z) >= Z_ACT ? "act" : "watch";
  return {
    id: `derived-${step.id}`,
    crewId: SIM_CREW.id,
    key: step.inputKey,
    severity,
    zScore: z,
    ruleId: severity === "act" ? "z-act" : "z-watch",
    message: "",
    mean: b.mean,
    std: b.std,
    value: step.resultValue,
    openedAt: step.completedAt ?? new Date(0).toISOString(),
    measurementId: step.measurementId,
    caseId: step.caseId,
    windowDays: b.windowDays,
  };
}

/**
 * The open emergency case for the simulated crew, persisted on every action so a reload resumes the same stage.
 * Returns `undefined` for `c` while no case is open.
 */
export function useEmergencyCase() {
  const caseLive = useLive(() => store.getOpenCase(SIM_CREW.id), []);
  const c = caseLive.data;
  const caseId = c?.id;
  const { data: steps } = useLive(() => (caseId ? store.listSteps(caseId) : Promise.resolve([] as ProtocolStep[])), [caseId]);
  const { data: intake } = useLive(
    () => (caseId ? (store.getMeta(intakeKey(caseId)) as Promise<CaseIntake | undefined>) : Promise.resolve(undefined)),
    [caseId],
  );
  const { data: caseNumber } = useLive(
    async () => (caseId ? (await store.listCases(SIM_CREW.id)).findIndex((x) => x.id === caseId) + 1 : undefined),
    [caseId],
  );
  const card = c?.protocolId ? getProtocol(c.protocolId) : undefined;

  async function save(patch: Partial<EmergencyCase>): Promise<EmergencyCase | undefined> {
    if (!c) return undefined;
    return store.saveCase({ ...c, ...patch });
  }

  async function startCase(narrative: string, details: CaseIntake): Promise<void> {
    const now = new Date().toISOString();
    const created = await store.saveCase({
      id: id("case"),
      crewId: SIM_CREW.id,
      narrative: narrative.trim(),
      regionIds: [],
      startedAt: now,
      status: "open",
      stage: "pinpoint",
    });
    await store.setMeta(intakeKey(created.id), details);
  }

  async function setIntake(details: CaseIntake): Promise<void> {
    if (caseId) await store.setMeta(intakeKey(caseId), details);
  }

  async function setRegions(regionIds: SkeletonRegionId[]): Promise<void> {
    await save({ regionIds });
  }

  /** Moves the case to `stage`. Entering the differential matches a protocol card once and writes its steps. */
  async function advance(stage: EmergencyStage, patch: Partial<EmergencyCase> = {}): Promise<void> {
    if (!c) return;
    if (stageIndex(stage) >= stageIndex("differential") && !c.protocolId) {
      const matched = matchProtocol(c.narrative, c.regionIds);
      await store.saveSteps(buildSteps(c.id, matched));
      await save({ ...patch, stage, protocolId: matched.id });
      return;
    }
    // Never move backwards by accident (e.g. a late click on an earlier panel).
    if (stageIndex(stage) < stageIndex(c.stage)) {
      await save(patch);
      return;
    }
    await save({ ...patch, stage });
  }

  async function saveStep(step: ProtocolStep): Promise<void> {
    await store.saveSteps([step]);
  }

  /** Queues the high-priority Earth packet and leaves the case in monitoring. */
  async function handoff(): Promise<void> {
    if (!c) return;
    const packet = await queueEmergencyCase(c.id);
    const fresh = (await store.getCase(c.id)) ?? c;
    await store.saveCase({ ...fresh, packetId: packet.id, status: "monitoring", stage: "monitoring" });
  }

  async function closeCase(): Promise<void> {
    if (!c) return;
    await save({ status: "closed", closedAt: new Date().toISOString() });
  }

  return {
    loading: caseLive.loading,
    c,
    steps: steps ?? [],
    intake: intake ?? undefined,
    caseNumber,
    card,
    update: save,
    startCase,
    setIntake,
    setRegions,
    advance,
    saveStep,
    handoff,
    closeCase,
  };
}

export type EmergencyApi = ReturnType<typeof useEmergencyCase>;
