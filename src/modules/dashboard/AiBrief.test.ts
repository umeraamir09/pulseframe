import "fake-indexeddb/auto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import pack from "../../knowledge/pack.json";
import sources from "../../knowledge/sources.json";
import { store } from "../../data/db";
import { BriefBody } from "./AiBrief";
import { BRIEF_CACHE_META_KEY, BRIEF_TIMEOUT_MS, briefCacheKey, getBrief, resolveBrief } from "./briefClient";
import type { BriefSummary } from "./briefSummary";

const SOURCES = sources as Record<string, { url: string | null }>;
const CHUNKS = (pack as Array<{ id: string; kind: string; cite: string[] }>).filter(
  (c) => c.kind === "baseline" && c.cite.some((s) => SOURCES[s]?.url),
);

const SUMMARY: BriefSummary = {
  days: 7,
  openAlerts: { watch: 1, act: 0, keys: ["heartRate"] },
  metrics: [{ key: "heartRate", n: 7, mean: 64, last: 71, baseMean: 62, baseStd: 4, z: 2.25 }],
  checklist: { done: 3, total: 9 },
};

const BULLETS = CHUNKS.slice(0, 3).map((c, i) => ({ text: `Point ${i} [${c.id}].`, citations: [c.id] }));

function stubFetch(impl: () => Promise<Response>) {
  const fn = vi.fn(impl);
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(async () => {
  await store.setMeta(BRIEF_CACHE_META_KEY, undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("brief cache key", () => {
  it("is stable for the same summary and changes with the data", async () => {
    const a = await briefCacheKey(SUMMARY);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await briefCacheKey(structuredClone(SUMMARY))).toBe(a);
    expect(await briefCacheKey({ ...SUMMARY, checklist: { done: 4, total: 9 } })).not.toBe(a);
  });
});

describe("getBrief", () => {
  it("calls /api/brief once, then serves unchanged data from IndexedDB", async () => {
    const fetchMock = stubFetch(async () => new Response(JSON.stringify({ bullets: BULLETS }), { status: 200 }));
    expect(await getBrief(SUMMARY)).toEqual(BULLETS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/brief");
    expect(JSON.parse(String(init.body))).toEqual(SUMMARY);

    // "Reload" with unchanged data: no new call.
    expect(await getBrief(structuredClone(SUMMARY))).toEqual(BULLETS);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Changed data or Refresh: one new call each.
    await getBrief({ ...SUMMARY, checklist: { done: 9, total: 9 } });
    await getBrief(SUMMARY, true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("returns nothing on a fallback response or a network error", async () => {
    stubFetch(async () => new Response(JSON.stringify({ error: "rate_limited", fallback: true }), { status: 503 }));
    expect(await getBrief(SUMMARY)).toBeUndefined();
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await getBrief(SUMMARY)).toBeUndefined();
    expect(await store.getMeta(BRIEF_CACHE_META_KEY)).toBeUndefined();
  });

  it("does not call the API when offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const fetchMock = stubFetch(async () => new Response("{}"));
    expect(await getBrief(SUMMARY)).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it(`aborts after ${BRIEF_TIMEOUT_MS} ms`, async () => {
    vi.useFakeTimers();
    stubFetch(
      () =>
        new Promise<Response>((_, reject) => {
          const signal = (fetch as unknown as { mock: { calls: Array<[string, RequestInit]> } }).mock.calls[0]![1].signal!;
          signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const pending = getBrief(SUMMARY);
    await vi.advanceTimersByTimeAsync(BRIEF_TIMEOUT_MS);
    expect(await pending).toBeUndefined();
  });
});

describe("BriefBody", () => {
  it("renders the bullets with source chips linking to sources.json urls", async () => {
    const shown = await resolveBrief(BULLETS);
    const html = renderToStaticMarkup(createElement(BriefBody, shown));
    expect(html.match(/<li>/g)?.length).toBeGreaterThanOrEqual(3);
    for (const chunk of CHUNKS.slice(0, 3)) {
      for (const sourceId of chunk.cite) {
        const url = SOURCES[sourceId]?.url;
        if (url) expect(html).toContain(`href="${url.replace(/&/g, "&amp;")}"`);
      }
    }
    expect(html).not.toContain("base:");
  });
});
