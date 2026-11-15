/**
 * Crew-facing text for a dashboard AI note. Plain words only: no z-scores,
 * no Greek letters, no em dashes, and no medication dose.
 */
import type { MeasurementKey } from "../../contracts/keys.ts";

export const NOTE_STATUSES = ["normal", "watch", "act"] as const;
export type NoteStatus = (typeof NOTE_STATUSES)[number];
export type NoteArrow = "up" | "down";

export const HEADLINE_MAX_WORDS = 8;
export const ACTION_MAX_WORDS = 12;
export const WHY_MAX_WORDS = 40;
/** Used when an act note arrives with no action line. */
export const ACT_ACTION = "Tell the flight surgeon";

export interface BriefNote {
  key: MeasurementKey;
  status: NoteStatus;
  headline: string;
  action?: string;
  why?: string;
  arrow?: NoteArrow;
  citations: string[];
}

/** A number plus a medicine unit. Glucose "mg/dL" is a reading, not a dose. */
const DOSE_RE = /\b\d+(?:\.\d+)?\s?(?:mcg|µg|μg|ug|iu)\b|\b\d+(?:\.\d+)?\s?mg\b(?!\s*\/)|\b\d+(?:\.\d+)?\s?(?:tablets?|capsules?|puffs?)\b/i;

export function hasMedicationDose(text: string): boolean {
  return DOSE_RE.test(text);
}

/**
 * Strip citation markers, z-scores, Greek stat letters and em dashes, then
 * keep the first `maxWords` words. Returns "" when nothing plain is left.
 */
export function crewPlain(text: string, maxWords: number): string {
  const flat = text
    .replace(/\s*\[[a-z0-9][a-z0-9:._-]*\]/gi, " ")
    .replace(/\bz\s*[- ]?\s*scores?\b(?:\s*(?:=|of|is)?\s*[-+]?\d+(?:\.\d+)?)?/gi, " ")
    .replace(/\bz\s*=\s*[-+]?\d+(?:\.\d+)?/gi, " ")
    .replace(/\bstandard deviations?\b/gi, " ")
    .replace(/[μσΣΔδµ]/g, " ")
    .replace(/[—–]/g, ", ")
    .replace(/\(\s*\)/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/,+\./g, ".")
    .replace(/([,.;:])\1+/g, "$1")
    .trim()
    .replace(/^[,.;:\s]+/, "")
    .replace(/[,:;]+$/g, "")
    .trim();
  const words = flat.split(" ").filter(Boolean).slice(0, maxWords);
  return words.join(" ").replace(/[,:;]+$/g, "").trim();
}

const STATUS_RANK: Record<NoteStatus, number> = { act: 2, watch: 1, normal: 0 };

/** Notes for these keys, highest status first. Keys with no note are skipped. */
export function notesFor(byKey: Partial<Record<MeasurementKey, BriefNote>>, keys: readonly MeasurementKey[]): BriefNote[] {
  return keys
    .flatMap((key) => {
      const note = byKey[key];
      return note ? [note] : [];
    })
    .sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status]);
}
