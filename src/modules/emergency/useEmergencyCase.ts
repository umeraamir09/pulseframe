import type { ProtocolStep } from "../../contracts";
import { SIM_CREW, store, useLive } from "../../data/db";
import {
  advance,
  closeCase,
  completeStep,
  handoffCase,
  recordCaseMeasurement,
  retreat,
  setRegions,
  skipRemainingActions,
  startCase,
} from "./caseActions";

/** The open case and its steps. Every store write refreshes this through useLive. */
export function useEmergencyCase() {
  const live = useLive(() => store.getOpenCase(SIM_CREW.id), []);
  const caseId = live.data?.id;
  const stepsLive = useLive(
    () => (caseId ? store.listSteps(caseId) : Promise.resolve([] as ProtocolStep[])),
    [caseId],
  );

  return {
    open: live.data,
    loading: live.loading && live.data === undefined,
    error: live.error,
    steps: stepsLive.data ?? [],
    startCase,
    setRegions,
    advance,
    retreat,
    completeStep,
    skipRemainingActions,
    handoffCase,
    closeCase,
    recordCaseMeasurement,
  };
}
