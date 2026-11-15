import { createContext, useContext } from "react";
import type { MeasurementKey } from "../../contracts";
import type { BriefNote } from "./briefCopy";

export type AiNotesPhase = "loading" | "ready" | "offline";

export interface AiNotesValue {
  enabled: boolean;
  phase: AiNotesPhase;
  refreshing: boolean;
  byKey: Partial<Record<MeasurementKey, BriefNote>>;
  refresh: () => void;
}

const EMPTY: AiNotesValue = {
  enabled: false,
  phase: "ready",
  refreshing: false,
  byKey: {},
  refresh: () => {},
};

export const AiNotesContext = createContext<AiNotesValue>(EMPTY);

export function useAiNotes(): AiNotesValue {
  return useContext(AiNotesContext);
}
