import { describe, expect, it } from "vitest";
import { PROTOCOL_CARDS } from "../../modules/protocols";
import { NASA_ISS_KIT_PDF_URL } from "./demoIssKit";
import { ACTIVE_INVENTORY } from "./index";
import { RESEARCHER_KIT } from "./researcherKit";

describe("RESEARCHER_KIT", () => {
  it("has the 30 researcher items and is the active inventory", () => {
    expect(RESEARCHER_KIT).toHaveLength(30);
    expect(ACTIVE_INVENTORY).toBe(RESEARCHER_KIT);
    expect(new Set(RESEARCHER_KIT.map((item) => item.id)).size).toBe(RESEARCHER_KIT.length);
  });

  it("maps every row to the InventoryItem contract with provenance", () => {
    for (const item of RESEARCHER_KIT) {
      expect(item.id).toMatch(/^kit-(white|red|purple|brown)-[a-z0-9-]+$/);
      expect(item.provenance).toBe("researcher-list");
      expect(item.sourceUrl).toBe(NASA_ISS_KIT_PDF_URL);
      expect(item.sourcePage).toMatch(/^\d+$/);
      for (const field of [item.name, item.pack, item.strength, item.route, item.location]) {
        expect(field.length).toBeGreaterThan(0);
      }
    }
  });

  it("never carries labeled dose text or other non-contract fields", () => {
    const allowed = [
      "id",
      "name",
      "pack",
      "strength",
      "route",
      "quantityOnBoard",
      "location",
      "sideEffects",
      "comments",
      "sourceUrl",
      "provenance",
      "sourcePage",
    ];
    for (const item of RESEARCHER_KIT) {
      expect(Object.keys(item).filter((key) => !allowed.includes(key))).toEqual([]);
    }
    expect(JSON.stringify(RESEARCHER_KIT)).not.toMatch(/labeledDose/i);
  });

  it("contains every candidate item id named by a protocol card", () => {
    const ids = new Set(RESEARCHER_KIT.map((item) => item.id));
    const missing = PROTOCOL_CARDS.flatMap((card) =>
      card.candidateItemIds.filter((id) => !ids.has(id)).map((id) => `${card.id} -> ${id}`),
    );
    expect(missing).toEqual([]);
  });
});
