import "fake-indexeddb/auto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { store } from "../../data/db";
import { AiNoteList, AiNoteRow, AiNotesRefreshButton } from "./AiNotes";
import { BRIEF_CACHE_META_KEY, BRIEF_TIMEOUT_MS, briefCacheKey, getBrief } from "./briefClient";
import { notesFor, type BriefNote } from "./briefCopy";
import type { BriefSummary } from "./briefSummary";

const SUMMARY: BriefSummary = {
  days: 7,
  openAlerts: { watch: 1, act: 0, keys: ["heartRate"] },
  metrics: [{ key: "heartRate", n: 7, mean: 64, last: 71, baseMean: 62, baseStd: 4, z: 2.25 }],
  checklist: { done: 3, total: 9 },
};

const NOTES: BriefNote[] = [
  {
    key: "heartRate",
    status: "act",
    headline: "15 above your normal",
    action: "Tell the flight surgeon",
    why: "Fluid shift can load the heart in the first weeks of flight.",
    arrow: "up",
    citations: ["base:heartrate-2"],
  },
  {
    key: "sleepHours",
    status: "watch",
    headline: "Short a couple of nights",
    citations: ["base:sleephours-2"],
  },
];

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
    const fetchMock = stubFetch(async () => new Response(JSON.stringify({ notes: NOTES }), { status: 200 }));
    expect(await getBrief(SUMMARY)).toEqual(NOTES);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/brief");
    expect(JSON.parse(String(init.body))).toEqual(SUMMARY);

    expect(await getBrief(structuredClone(SUMMARY))).toEqual(NOTES);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await getBrief({ ...SUMMARY, checklist: { done: 9, total: 9 } });
    await getBrief(SUMMARY, true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("caches an empty note list when nothing is notable", async () => {
    const fetchMock = stubFetch(async () => new Response(JSON.stringify({ notes: [] }), { status: 200 }));
    expect(await getBrief(SUMMARY)).toEqual([]);
    expect(await getBrief(SUMMARY)).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns nothing on a fallback response, a bad body, or a network error", async () => {
    stubFetch(async () => new Response(JSON.stringify({ error: "rate_limited", fallback: true }), { status: 503 }));
    expect(await getBrief(SUMMARY)).toBeUndefined();
    stubFetch(async () => new Response(JSON.stringify({ bullets: [{ text: "old shape", citations: [] }] }), { status: 200 }));
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
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    stubFetch(
      () =>
        new Promise<Response>((_, reject) => {
          const signal = (fetch as unknown as { mock: { calls: Array<[string, RequestInit]> } }).mock.calls[0]![1].signal!;
          signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const pending = getBrief(SUMMARY);
    // The cache key is a real SHA-256, so the abort timer is not armed until that settles.
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(BRIEF_TIMEOUT_MS);
    await expect(pending).resolves.toBeUndefined();
  });
});

describe("AI note row", () => {
  const html = renderToStaticMarkup(createElement(AiNoteList, { notes: NOTES }));

  it("shows a chip, a short headline, an arrow and an action on the matching metric", () => {
    expect(html).toContain("15 above your normal");
    expect(html).toContain("Act");
    expect(html).toContain("Tell the flight surgeon");
    expect(html).toContain("Above your normal");
    expect(html).toContain('data-metric="heartRate"');
    expect(html).toContain("Short a couple of nights");
    expect(html).toContain("Watch");
    expect(html).toContain(">Why?<");
    expect(html).toContain("Fluid shift can load the heart");
  });

  it("hides sources, z-scores and em dashes", () => {
    expect(html).not.toContain("Sources");
    expect(html).not.toContain("NOT FOUND");
    expect(html).not.toContain("base:");
    expect(html).not.toMatch(/[—–μσ]|\bz\s*=/);
    expect(html).not.toContain("href=");
  });

  it("renders nothing when a metric has no note", () => {
    expect(renderToStaticMarkup(createElement(AiNoteList, { notes: [] }))).toBe("");
    expect(renderToStaticMarkup(createElement(AiNoteRow, { note: { ...NOTES[1]!, why: undefined, action: undefined } }))).not.toContain("Why?");
  });

  it("keeps only the keys for that card, act first", () => {
    const byKey = { heartRate: NOTES[0], sleepHours: NOTES[1], oxygenSat: { ...NOTES[1]!, key: "oxygenSat" as const, status: "normal" as const } };
    expect(notesFor(byKey, ["sleepHours", "heartRate"]).map((n) => n.key)).toEqual(["heartRate", "sleepHours"]);
    expect(notesFor(byKey, ["temperatureC"])).toEqual([]);
    expect(notesFor(byKey, ["systolicBP", "diastolicBP"])).toEqual([]);
  });
});

describe("AI notes refresh control", () => {
  function button(phase: "loading" | "ready" | "offline", refreshing = false) {
    return renderToStaticMarkup(createElement(AiNotesRefreshButton, { phase, refreshing, onClick: () => {} }));
  }

  it("names loading, offline, refresh and refreshing", () => {
    expect(button("loading")).toContain("Loading…");
    expect(button("loading")).toContain("disabled");
    expect(button("offline")).toContain("Offline");
    expect(button("offline")).toContain("AI notes offline");
    expect(button("ready")).toContain("Refresh AI");
    expect(button("ready")).not.toContain("disabled");
    expect(button("ready", true)).toContain("Refreshing…");
    expect(button("ready", true)).toContain("disabled");
    for (const html of [button("loading"), button("offline"), button("ready"), button("ready", true)]) {
      expect(html).not.toMatch(/[—–]/);
    }
  });
});
