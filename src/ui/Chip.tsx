import type { ReactNode } from "react";
import type { AlertSeverity } from "../contracts";

export type ChipTone = AlertSeverity | "normal" | "ok" | "neutral" | "accent";

const LABEL: Record<AlertSeverity, string> = { act: "Act", watch: "Watch" };

/** Status pill: a dot plus a word. Status colors only ever mean status, and always come with text. */
export function Chip({ tone, children, size }: { tone: ChipTone; children?: ReactNode; size?: "sm" }) {
  const cls = tone === "ok" ? "normal" : tone;
  return (
    <span className={`status-chip ${cls}${size ? ` ${size}` : ""}`}>
      <span className="dot" aria-hidden="true" />
      {children ?? (tone === "act" || tone === "watch" ? LABEL[tone] : tone === "normal" || tone === "ok" ? "Normal" : null)}
    </span>
  );
}
