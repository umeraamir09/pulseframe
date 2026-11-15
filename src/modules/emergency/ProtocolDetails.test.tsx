import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GENERAL_FALLBACK_ID, PROTOCOL_CARDS, getProtocol } from "../protocols";
import { ProtocolDetails } from "./ProtocolDetails";
import { DifferentialStage } from "./stages/DifferentialStage";

describe("protocol card rendering", () => {
  it.each(PROTOCOL_CARDS.map((card) => [card.id, card] as const))("renders %s in the differential stage", (_id, card) => {
    const html = renderToStaticMarkup(createElement(DifferentialStage, { card, onContinue: async () => {} }));
    expect(html).toContain(card.differential[0]!.label.replace(/&/g, "&amp;"));
    for (const flag of card.redFlagsLifeThreat ?? []) {
      expect(html).toContain(flag.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;"));
    }
    expect(html).not.toMatch(/labeledDose/i);
  });

  it("renders nothing extra for a team card without researcher fields", () => {
    const html = renderToStaticMarkup(createElement(ProtocolDetails, { card: getProtocol(GENERAL_FALLBACK_ID)! }));
    expect(html).toBe("");
  });

  it("links every source of a research card", () => {
    const card = getProtocol("choking-airway")!;
    const html = renderToStaticMarkup(createElement(ProtocolDetails, { card }));
    expect(html).toContain("Act now if any of these");
    expect(html).toContain("If the ground cannot be reached");
    expect(html.match(/<a href=/g)?.length).toBe(card.sources!.length);
  });
});
