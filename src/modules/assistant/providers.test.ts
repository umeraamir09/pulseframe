import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_ISS_KIT_SUBSET } from "../../data/inventory/demoIssKit";
import { SIM_CREW, store } from "../../data/store";
import { LIVE_FALLBACK_NOTE, NO_ONBOARD_ITEM, NO_OPEN_CASE_REPLY, OFFLINE_COMMANDS_ONLY, PROVENANCE_LABEL } from "./copy";
import {
  LAST_TURN_MAX_CHARS,
  LIVE_TIMEOUT_MS,
  getProvider,
  isOfflineCommand,
  liveProvider,
  offlineProvider,
  type CaseContext,
} from "./providers";

const chest: CaseContext = {
  caseId: "case-1",
  crewId: SIM_CREW.id,
  narrative: "Chest tightness after resistive exercise session",
  regionIds: ["chest"],
  protocolId: "chest-tightness-post-exercise",
};

describe("offlineProvider", () => {
  afterEach(async () => {
    await store.resetAll();
  });

  it("suggest with no open case names Emergency", async () => {
    const reply = await offlineProvider.ask({ command: "suggest", inventory: DEMO_ISS_KIT_SUBSET });
    expect(reply.text).toBe(NO_OPEN_CASE_REPLY);
    expect(reply.draft).toBeUndefined();
  });

  it("suggest uses the open case protocol card and does not invent items", async () => {
    const reply = await offlineProvider.ask({ command: "suggest", inventory: DEMO_ISS_KIT_SUBSET, caseCtx: chest });
    expect(reply.text).toContain("From protocol card Chest tightness after resistive exercise");
    expect(reply.text).toContain(NO_ONBOARD_ITEM);
    expect(reply.draft).toEqual({
      itemIds: [],
      rationale: "From protocol card Chest tightness after resistive exercise",
      cautions: expect.any(String),
    });
  });

  it("suggest matches the narrative when the case has no protocol id", async () => {
    const reply = await offlineProvider.ask({
      command: "suggest",
      inventory: DEMO_ISS_KIT_SUBSET,
      caseCtx: { ...chest, protocolId: undefined, narrative: "headache", regionIds: ["head"] },
    });
    expect(reply.text).toContain("From protocol card Headache in flight (including high CO2)");
    expect(reply.draft).toMatchObject({
      itemIds: ["kit-white-acetaminophen", "kit-white-aspirin", "kit-white-ibuprofen"],
    });
  });

  it("suggest falls back when no card keyword matches", async () => {
    const reply = await offlineProvider.ask({
      command: "suggest",
      inventory: DEMO_ISS_KIT_SUBSET,
      caseCtx: { ...chest, protocolId: undefined, narrative: "feeling odd", regionIds: ["head"] },
    });
    expect(reply.text).toContain("From protocol card General onboard fallback");
    expect(reply.text).toContain(NO_ONBOARD_ITEM);
  });

  it("find searches name and comments", async () => {
    const reply = await offlineProvider.ask({ command: "find contact lenses", inventory: DEMO_ISS_KIT_SUBSET });
    expect(reply.text).toContain("Olopatadine");
    expect(reply.text).toContain("Hypromellose");
    expect(reply.text).not.toContain("Aspirin");
    expect(reply.text).toContain(PROVENANCE_LABEL);
  });

  it("item shows one checklist row and rejects an unknown id", async () => {
    const found = await offlineProvider.ask({ command: "item kit-white-aspirin", inventory: DEMO_ISS_KIT_SUBSET });
    expect(found.text).toContain("Take with food.");
    expect(found.text).toContain("325 mg");
    const missing = await offlineProvider.ask({ command: "item kit-fake-x", inventory: DEMO_ISS_KIT_SUBSET });
    expect(missing.text).toContain('No onboard item with id "kit-fake-x"');
  });

  it("help lists the commands", async () => {
    const reply = await offlineProvider.ask({ command: "help", inventory: [] });
    for (const command of ["suggest", "find <text>", "item <id>", "alerts", "help"]) {
      expect(reply.text).toContain(command);
    }
  });

  it("alerts lists open alerts with the baseline explanation and skips acked ones", async () => {
    expect((await offlineProvider.ask({ command: "alerts", inventory: [] })).text).toBe("No open alerts.");
    await store.saveAlert({
      id: "al-open",
      crewId: SIM_CREW.id,
      key: "heartRate",
      severity: "act",
      ruleId: "z-act",
      zScore: 5.2,
      mean: 63.3,
      std: 2.5,
      value: 78,
      message: "seed",
      openedAt: new Date().toISOString(),
    });
    await store.saveAlert({
      id: "al-acked",
      crewId: SIM_CREW.id,
      key: "sleepHours",
      severity: "watch",
      ruleId: "z-watch",
      zScore: -2.1,
      mean: 6.5,
      std: 0.4,
      value: 5.1,
      message: "seed",
      openedAt: new Date().toISOString(),
      ackedAt: new Date().toISOString(),
    });
    const reply = await offlineProvider.ask({ command: "explain alerts", inventory: [] });
    expect(reply.text).toContain("Heart rate");
    expect(reply.text).toContain("not a diagnosis");
    expect(reply.text).not.toContain("Sleep");
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const HR_QUESTION = "what is normal in-flight heart rate?";

describe("liveProvider", () => {
  afterEach(async () => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    await store.resetAll();
  });

  it("sends free text to /api/assistant and returns text, citations, notFound and draft", async () => {
    const calls: { url: string; body: unknown }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init?.body)) });
      return jsonResponse({
        text: "Mean 24 h heart rate is unchanged in flight [cv:space-motion-sickness:heartrate.2].",
        citations: ["cv:space-motion-sickness:heartrate.2"],
        draft: { itemIds: [], rationale: "x", cautions: "y" },
        notFound: false,
        usage: { estimatedInputTokens: 1200 },
      });
    });
    const reply = await liveProvider.ask({ command: `  ${HR_QUESTION} `, inventory: DEMO_ISS_KIT_SUBSET, caseCtx: chest });
    expect(reply).toEqual({
      text: "Mean 24 h heart rate is unchanged in flight [cv:space-motion-sickness:heartrate.2].",
      citations: ["cv:space-motion-sickness:heartrate.2"],
      draft: { itemIds: [], rationale: "x", cautions: "y" },
      notFound: false,
      kind: "research",
      blocks: [],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("/api/assistant");
    expect(calls[0]!.body).toEqual({
      command: HR_QUESTION,
      caseCtx: chest,
      inventoryIds: DEMO_ISS_KIT_SUBSET.map((item) => item.id),
    });
  });

  it("sends the previous Q/A pair as lastTurn, clipped", async () => {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return jsonResponse({ text: "ok", citations: ["x:y"], notFound: false });
    });
    await liveProvider.ask({
      command: "and when asleep?",
      inventory: [],
      lastTurn: { question: HR_QUESTION, answer: "a".repeat(LAST_TURN_MAX_CHARS + 50) },
    });
    expect(bodies[0]!.lastTurn).toEqual({ question: HR_QUESTION, answer: "a".repeat(LAST_TURN_MAX_CHARS) });
    await liveProvider.ask({ command: "next", inventory: [], lastTurn: { question: " ", answer: "x" } });
    expect(bodies[1]).not.toHaveProperty("lastTurn");
  });

  it("passes notFound through with no citations", async () => {
    vi.stubGlobal("fetch", async () =>
      jsonResponse({ text: "Not in Pulseframe research. Contact the flight surgeon.", citations: [], notFound: true }),
    );
    const reply = await liveProvider.ask({ command: "how do I treat appendicitis?", inventory: [] });
    expect(reply).toEqual({
      text: "Not in Pulseframe research. Contact the flight surgeon.",
      citations: [],
      notFound: true,
      kind: "notFound",
      blocks: [],
    });
  });

  it("drops a null draft and non-string citation ids", async () => {
    vi.stubGlobal("fetch", async () => jsonResponse({ text: "ok", citations: ["a:b", 3, ""], draft: null, notFound: false }));
    const reply = await liveProvider.ask({ command: "question", inventory: [] });
    expect(reply).toEqual({ text: "ok", citations: ["a:b"], notFound: false, kind: "research", blocks: [] });
  });

  it("passes kind and valid blocks through and drops blocks it cannot read", async () => {
    const range = { type: "range", label: "Resting heart rate", low: 60, high: 100, unit: "bpm", note: "", cite: ["a:b"] };
    vi.stubGlobal("fetch", async () =>
      jsonResponse({
        kind: "general",
        text: "Hi!",
        citations: [],
        blocks: [range, { type: "chart", data: [] }, { type: "list", title: "t" }],
        notFound: false,
      }),
    );
    const reply = await liveProvider.ask({ command: "hello", inventory: [] });
    expect(reply.kind).toBe("general");
    expect(reply.blocks).toEqual([range]);
  });

  it("keeps kind and notFound consistent", async () => {
    vi.stubGlobal("fetch", async () => jsonResponse({ kind: "notFound", text: "Not in research.", citations: [], blocks: [{}] }));
    const reply = await liveProvider.ask({ command: "q", inventory: [] });
    expect(reply).toMatchObject({ kind: "notFound", notFound: true, blocks: [] });
  });

  it.each(["help", "find aspirin", "item kit-white-aspirin", "alerts", "explain alerts", "suggest", "  HELP  "])(
    "runs the command %j offline with no fetch call",
    async (command) => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
      const reply = await liveProvider.ask({ command, inventory: DEMO_ISS_KIT_SUBSET, caseCtx: chest });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(reply.text).not.toContain(LIVE_FALLBACK_NOTE);
      expect(reply).toEqual(await offlineProvider.ask({ command, inventory: DEMO_ISS_KIT_SUBSET, caseCtx: chest }));
    },
  );

  it("isOfflineCommand matches only the offline verbs", () => {
    for (const command of ["help", "find x", "item y", "alerts", "Explain alerts", "suggest headache"]) {
      expect(isOfflineCommand(command), command).toBe(true);
    }
    for (const command of [HR_QUESTION, "explain my heart rate", "helpful tips?", "finding"]) {
      expect(isOfflineCommand(command), command).toBe(false);
    }
  });

  it.each([
    ["404 (no /api)", async () => new Response("missing", { status: 404 })],
    ["503 missing key", async () => jsonResponse({ error: "missing_key", fallback: true }, 503)],
    ["503 rate limited", async () => jsonResponse({ error: "rate_limited", fallback: true }, 503)],
    ["502 bad model output", async () => jsonResponse({ error: "bad_model_output", fallback: true }, 502)],
    ["504 timeout", async () => jsonResponse({ error: "timeout", fallback: true }, 504)],
    ["network error", async () => Promise.reject(new TypeError("Failed to fetch"))],
    ["200 with empty text", async () => jsonResponse({ text: "  ", citations: [], notFound: false })],
    ["200 with non-JSON body", async () => new Response("<html>", { status: 200 })],
  ])("falls back offline with the note on %s", async (_name, impl) => {
    vi.stubGlobal("fetch", impl);
    const reply = await liveProvider.ask({ command: HR_QUESTION, inventory: [] });
    expect(reply.text).toContain(LIVE_FALLBACK_NOTE);
    expect(reply.text).toContain(OFFLINE_COMMANDS_ONLY);
    expect(reply.citations).toBeUndefined();
    expect(reply.notFound).toBeUndefined();
  });

  it("falls back within 9 seconds when the live call hangs", async () => {
    expect(LIVE_TIMEOUT_MS).toBeLessThanOrEqual(8000);
    vi.useFakeTimers();
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    });
    const pending = liveProvider.ask({ command: HR_QUESTION, inventory: [] });
    await vi.advanceTimersByTimeAsync(LIVE_TIMEOUT_MS);
    const reply = await pending;
    expect(reply.text).toContain(LIVE_FALLBACK_NOTE);
    expect(reply.text.trim().length).toBeGreaterThan(LIVE_FALLBACK_NOTE.length);
  });

  it("getProvider stays offline unless VITE_ASSISTANT_MODE is live", () => {
    expect(getProvider().name).toBe("offline");
    vi.stubEnv("VITE_ASSISTANT_MODE", "live");
    expect(getProvider().name).toBe("live");
  });
});
