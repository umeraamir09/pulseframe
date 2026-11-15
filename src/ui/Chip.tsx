import type { ReactNode } from "react";
import type { AlertSeverity } from "../contracts";

export type ChipTone = AlertSeverity | "ok" | "neutral";

/** Small status pill. Watch and Act always pair color with a text label. */
export function Chip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  return <span className={`chip chip-${tone} ${tone}`}>{children}</span>;
}
