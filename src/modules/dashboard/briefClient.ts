/**
 * Client side of the dashboard AI brief (issue 30, step 7): load the week's
 * rows, reduce them to a BriefSummary, and fetch or reuse the cached brief.
 *
 * The cache lives in IndexedDB (the store's meta table), keyed by a SHA-256
 * of the summary JSON, so /api/brief is called at most once per data change.
 */
import {
  FIRST_SEED_DAY,
  MISSION_DAY_TODAY,
  SIM_CREW,
  missionDayStart,
  sha256Hex,
  store,
} from "../../data/db";
import { MEASUREMENT_KEYS, type MeasurementKey } from "../../contracts/keys.ts";
import { buildBriefSummary, type BriefSummary } from "./briefSummary";
import type { BriefNote, NoteArrow, NoteStatus } from "./briefCopy";

export const BRIEF_TIMEOUT_MS = 8000;
export const BRIEF_CACHE_META_KEY = "aiBrief";
/** Bump when the brief's prompt or shape changes so old cached briefs are not reused. */
export const BRIEF_CACHE_VERSION = 2;

export type { BriefNote };

export interface CachedBrief {
  key: string;
  notes: BriefNote[];
}

export async function loadBriefSummary(): Promise<BriefSummary> {
  const crew = SIM_CREW.id;
  const weekStart = missionDayStart(FIRST_SEED_DAY).toISOString();
  const [measurements, alerts, baselines, radiation, checklist] = await Promise.all([
    store.listMeasurements(crew, weekStart),
    store.listAlerts(crew),
    store.getBaselines(crew),
    store.listRadiation(crew, weekStart),
    store.listChecklist(String(MISSION_DAY_TODAY)),
  ]);
  return buildBriefSummary({
    days: MISSION_DAY_TODAY - FIRST_SEED_DAY + 1,
    measurements,
    alerts,
    baselines,
    radiation,
    checklist,
  });
}

/** buildBriefSummary emits keys in a fixed order, so JSON.stringify is stable. */
export function briefCacheKey(summary: BriefSummary): Promise<string> {
  return sha256Hex(`v${BRIEF_CACHE_VERSION}:${JSON.stringify(summary)}`);
}

const KEYS = new Set<string>(MEASUREMENT_KEYS);
const STATUSES = new Set<string>(["normal", "watch", "act"]);

function isNote(value: unknown): value is BriefNote {
  if (!value || typeof value !== "object") return false;
  const note = value as Partial<BriefNote>;
  return (
    typeof note.key === "string" &&
    KEYS.has(note.key) &&
    typeof note.status === "string" &&
    STATUSES.has(note.status) &&
    typeof note.headline === "string" &&
    note.headline.length > 0 &&
    (note.action === undefined || typeof note.action === "string") &&
    (note.why === undefined || typeof note.why === "string") &&
    (note.arrow === undefined || note.arrow === "up" || note.arrow === "down") &&
    Array.isArray(note.citations) &&
    note.citations.every((c) => typeof c === "string")
  );
}

/** An empty list is valid: nothing notable this week. */
function isNotes(value: unknown): value is BriefNote[] {
  return Array.isArray(value) && value.every(isNote);
}

export async function readCachedBrief(key: string): Promise<BriefNote[] | undefined> {
  const row = (await store.getMeta(BRIEF_CACHE_META_KEY)) as Partial<CachedBrief> | undefined;
  return row?.key === key && isNotes(row.notes) ? row.notes : undefined;
}

export async function writeCachedBrief(key: string, notes: BriefNote[]): Promise<void> {
  await store.setMeta(BRIEF_CACHE_META_KEY, { key, notes } satisfies CachedBrief);
}

/** Throws on any failure (offline, timeout, non-2xx, bad body); the caller hides the notes. */
export async function fetchBrief(summary: BriefSummary): Promise<BriefNote[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), BRIEF_TIMEOUT_MS);
  try {
    const res = await fetch("/api/brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(summary),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { notes?: unknown };
    if (!isNotes(body.notes)) throw new Error("Bad brief response");
    return body.notes.map(cleanNote);
  } finally {
    clearTimeout(timer);
  }
}

function cleanNote(note: BriefNote): BriefNote {
  const next: BriefNote = {
    key: note.key as MeasurementKey,
    status: note.status as NoteStatus,
    headline: note.headline,
    citations: note.citations.filter(Boolean),
  };
  if (note.action) next.action = note.action;
  if (note.why) next.why = note.why;
  if (note.arrow === "up" || note.arrow === "down") next.arrow = note.arrow satisfies NoteArrow;
  return next;
}

/**
 * Cached notes for this summary, or a fresh set (then cached). `force` skips
 * the cache read (the Refresh control). Returns undefined when offline or on failure.
 * An empty array means the week had nothing notable.
 */
export async function getBrief(summary: BriefSummary, force = false): Promise<BriefNote[] | undefined> {
  const key = await briefCacheKey(summary);
  if (!force) {
    const cached = await readCachedBrief(key).catch(() => undefined);
    if (cached) return cached;
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) return undefined;
  try {
    const notes = await fetchBrief(summary);
    await writeCachedBrief(key, notes).catch(() => undefined);
    return notes;
  } catch {
    return undefined;
  }
}
