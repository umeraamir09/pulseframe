import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DEMO_ISS_KIT_SUBSET } from "../../data/inventory/demoIssKit";
import { APP_GUIDE, APP_ROUTE_PATHS } from "../../knowledge/app-guide";
import { readEmergencyQuery } from "../emergency/prefill";
import { ActionCard } from "./ActionCard";
import { ASSISTANT_DISCLAIMER, DOSE_LINE, GENERAL_LABEL, RED_FLAG_LINE } from "./copy";
import { emergencyReply } from "./emergency";
import { offlineProvider } from "./providers";

const EM = /\u2014/;

describe("emergency routing", () => {
  it("routes chest pain to Emergency with the matching card and a red flag", async () => {
    const reply = await offlineProvider.ask({
      command: "I have a hard pain in my chest",
      inventory: DEMO_ISS_KIT_SUBSET,
    });
    expect(reply.kind).toBe("emergency");
    expect(reply.redFlag).toBe(RED_FLAG_LINE);
    expect(reply.title).toBe("Chest tightness after resistive exercise");
    expect(reply.text).toContain("Chest tightness after resistive exercise");
    expect(reply.text).toContain(ASSISTANT_DISCLAIMER);
    expect(reply.text).not.toContain("Not in Pulseframe research");
    expect(reply.text).not.toMatch(EM);
    const open = reply.actions?.find((action) => action.label === "Open Emergency");
    const card = reply.actions?.find((action) => action.label.startsWith("Open Chest tightness"));
    expect(open?.to.startsWith("/emergency?")).toBe(true);
    expect(card?.to).toBe(open?.to);
    const prefill = readEmergencyQuery(open!.to.split("?")[1] ?? "");
    expect(prefill.situation).toBe("I have a hard pain in my chest");
    expect(prefill.regionId).toBe("chest");
    expect(reply.steps?.some((step) => step.includes("8 steps"))).toBe(true);
  });

  it.each([
    ["I can't breathe", "Choking or blocked airway"],
    ["there is bleeding from a cut", "Bleeding, cut or scrape"],
    ["smoke in the module", "Fire, smoke or a burn"],
    ["something in my eye", "Something in the eye or a scratched eye"],
  ])("routes %j to %s", async (command, title) => {
    const reply = await offlineProvider.ask({ command, inventory: [] });
    expect(reply.kind).toBe("emergency");
    expect(reply.title).toBe(title);
    expect(reply.redFlag).toBe(RED_FLAG_LINE);
    expect(reply.actions?.[0]?.to.startsWith("/emergency?")).toBe(true);
  });

  it("still opens Emergency when no card matches", async () => {
    const reply = await offlineProvider.ask({ command: "they are unconscious", inventory: [] });
    expect(reply.kind).toBe("emergency");
    expect(reply.redFlag).toBe(RED_FLAG_LINE);
    expect(reply.actions?.map((action) => action.label)).toEqual(["Open Emergency"]);
    expect(reply.text).toContain("No protocol card matched");
  });

  it("renders the chest-pain reply as an action card, not a text wall", () => {
    const reply = emergencyReply("I have a hard pain in my chest");
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(ActionCard, { reply })));
    expect(html).toContain("action-card");
    expect(html).toContain("Open Emergency");
    expect(html).toContain("Chest tightness after resistive exercise");
    expect(html).toContain(RED_FLAG_LINE);
    expect(html).toContain('href="/emergency?');
    expect(html).toContain("region=chest");
    expect(html).not.toMatch(EM);
  });
});

describe("app help", () => {
  it("explains how to log radiation from the real page", async () => {
    const reply = await offlineProvider.ask({ command: "how do I log radiation", inventory: [] });
    expect(reply.kind).toBe("app");
    expect(reply.title).toBe("Radiation log");
    expect(reply.text).toContain("Add reading");
    expect(reply.text).toContain("Save reading");
    expect(reply.text).toContain("dosimeter");
    expect(reply.actions?.[0]?.to).toBe("/radiation");
    expect(reply.text).toContain(ASSISTANT_DISCLAIMER);
  });

  it("explains what Act means", async () => {
    const reply = await offlineProvider.ask({ command: "what does Act mean", inventory: [] });
    expect(reply.kind).toBe("app");
    expect(reply.title).toBe("Alerts");
    expect(reply.text).toContain("at least 3 standard deviations");
    expect(reply.text).toContain("Watch");
    expect(reply.text).toContain("flight surgeon");
    expect(reply.actions?.[0]?.to).toBe("/alerts");
  });

  it("covers every app route", () => {
    for (const path of APP_ROUTE_PATHS) {
      const entry = APP_GUIDE.find((item) => item.path === path);
      expect(entry?.steps.length).toBeGreaterThan(0);
      expect(entry?.about).toBeTruthy();
    }
    expect(APP_GUIDE.some((entry) => entry.id === "earth-sync")).toBe(true);
    expect(JSON.stringify(APP_GUIDE)).not.toMatch(EM);
  });
});

describe("general answers", () => {
  it("answers why astronauts float without a research citation", async () => {
    const reply = await offlineProvider.ask({ command: "why do astronauts float", inventory: [] });
    expect(reply.kind).toBe("general");
    expect(reply.badge).toBe(GENERAL_LABEL);
    expect(reply.text.startsWith(GENERAL_LABEL)).toBe(true);
    expect(reply.text.toLowerCase()).toContain("microgravity");
    expect(reply.text).toContain(ASSISTANT_DISCLAIMER);
    expect(reply.text).not.toContain("Not in Pulseframe research");
  });
});

describe("formulary-only medicines", () => {
  it("names onboard aspirin, suggests no dose, and keeps confirm-before-given", async () => {
    const reply = await offlineProvider.ask({
      command: "what dose of aspirin should I give",
      inventory: DEMO_ISS_KIT_SUBSET,
    });
    expect(reply.kind).toBe("formulary");
    expect(reply.text).toContain(DOSE_LINE);
    expect(reply.text).toContain("Aspirin");
    expect(reply.text).toContain("Confirm before given");
    expect(reply.text).not.toMatch(/\d+\s*mg/i);
    expect(reply.draft).toMatchObject({ itemIds: ["kit-white-aspirin"] });
    expect(reply.text).toContain(ASSISTANT_DISCLAIMER);
  });

  it("does not name or dose a medicine that is not in the kit", async () => {
    const reply = await offlineProvider.ask({
      command: "give 10 mg of morphine",
      inventory: DEMO_ISS_KIT_SUBSET,
    });
    expect(reply.kind).toBe("formulary");
    expect(reply.text).toContain("Morphine is not in the onboard inventory");
    expect(reply.text).toContain(DOSE_LINE);
    expect(reply.text).not.toMatch(/\d+\s*mg/i);
    expect(reply.text.toLowerCase()).not.toContain("10 mg");
    expect(reply.draft).toBeUndefined();
  });
});
