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
import { EMPTY_CITATIONS, loadCitations, type ResolvedCitations } from "../assistant/citations";
import { buildBriefSummary, type BriefSummary } from "./briefSummary";

export const BRIEF_TIMEOUT_MS = 8000;
export const BRIEF_CACHE_META_KEY = "aiBrief";
/** Bump when the brief's prompt or shape changes so old cached briefs are not reused. */
export const BRIEF_CACHE_VERSION = 1;

export interface BriefBullet {
  text: string;
  citations: string[];
}

export interface CachedBrief {
  key: string;
  bullets: BriefBullet[];
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

function isBullets(value: unknown): value is BriefBullet[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (b) =>
        b &&
        typeof b === "object" &&
        typeof (b as BriefBullet).text === "string" &&
        Array.isArray((b as BriefBullet).citations) &&
        (b as BriefBullet).citations.every((c) => typeof c === "string"),
    )
  );
}

export async function readCachedBrief(key: string): Promise<BriefBullet[] | undefined> {
  const row = (await store.getMeta(BRIEF_CACHE_META_KEY)) as Partial<CachedBrief> | undefined;
  return row?.key === key && isBullets(row.bullets) ? row.bullets : undefined;
}

export async function writeCachedBrief(key: string, bullets: BriefBullet[]): Promise<void> {
  await store.setMeta(BRIEF_CACHE_META_KEY, { key, bullets } satisfies CachedBrief);
}

/** Throws on any failure (offline, timeout, non-2xx, bad body); the caller hides the brief. */
export async function fetchBrief(summary: BriefSummary): Promise<BriefBullet[]> {
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
    const body = (await res.json()) as { bullets?: unknown };
    if (!isBullets(body.bullets)) throw new Error("Bad brief response");
    return body.bullets.map((b) => ({ text: b.text, citations: b.citations.filter(Boolean) }));
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Cached brief for this summary, or a fresh one (then cached). `force` skips
 * the cache read (the Refresh button). Returns undefined when offline or on failure.
 */
export async function getBrief(summary: BriefSummary, force = false): Promise<BriefBullet[] | undefined> {
  const key = await briefCacheKey(summary);
  if (!force) {
    const cached = await readCachedBrief(key).catch(() => undefined);
    if (cached) return cached;
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) return undefined;
  try {
    const bullets = await fetchBrief(summary);
    await writeCachedBrief(key, bullets).catch(() => undefined);
    return bullets;
  } catch {
    return undefined;
  }
}

export interface ShownBrief {
  bullets: BriefBullet[];
  citations: ResolvedCitations;
}

/** Bullets plus their source links (chunk id → sources.json). */
export async function resolveBrief(bullets: BriefBullet[]): Promise<ShownBrief> {
  const ids = [...new Set(bullets.flatMap((b) => b.citations))];
  const citations = await loadCitations(ids).catch(() => EMPTY_CITATIONS);
  return { bullets, citations };
}
