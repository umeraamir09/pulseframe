import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_ISS_KIT_SUBSET } from "../../data/inventory/demoIssKit";
import { SIM_CREW, store } from "../../data/store";
import { LIVE_FALLBACK_NOTE, NO_ONBOARD_ITEM, NO_OPEN_CASE_REPLY, PROVENANCE_LABEL } from "./copy";
import { LIVE_TIMEOUT_MS, getProvider, liveProvider, offlineProvider, type CaseContext } from "./providers";

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

describe("liveProvider", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns the live text when /api/assistant answers", async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ text: "live ok", draft: { itemIds: [], rationale: "x", cautions: "y" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const reply = await liveProvider.ask({ command: "help", inventory: DEMO_ISS_KIT_SUBSET, caseCtx: chest });
    expect(reply.text).toBe("live ok");
    expect(reply.text).not.toContain(LIVE_FALLBACK_NOTE);
    expect(bodies[0]).toEqual({
      command: "help",
      caseCtx: chest,
      inventoryIds: DEMO_ISS_KIT_SUBSET.map((item) => item.id),
    });
  });

  it("falls back when /api/assistant is missing", async () => {
    vi.stubGlobal("fetch", async () => new Response("missing", { status: 404 }));
    const reply = await liveProvider.ask({ command: "help", inventory: [] });
    expect(reply.text).toContain("Commands:");
    expect(reply.text).toContain(LIVE_FALLBACK_NOTE);
  });

  it("falls back within 9 seconds when the live call hangs", async () => {
    expect(LIVE_TIMEOUT_MS).toBeLessThanOrEqual(8000);
    vi.useFakeTimers();
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    });
    const pending = liveProvider.ask({ command: "help", inventory: [] });
    await vi.advanceTimersByTimeAsync(LIVE_TIMEOUT_MS);
    const reply = await pending;
    expect(reply.text).toContain(LIVE_FALLBACK_NOTE);
    expect(reply.text).toContain("Commands:");
  });

  it("getProvider stays offline unless VITE_ASSISTANT_MODE is live", () => {
    expect(getProvider().name).toBe("offline");
    vi.stubEnv("VITE_ASSISTANT_MODE", "live");
    expect(getProvider().name).toBe("live");
  });
});
