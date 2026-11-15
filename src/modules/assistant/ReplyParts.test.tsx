import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCitationIndex } from "../../../scripts/citationIndexPlugin";
import { DEMO_ISS_KIT_SUBSET } from "../../data/inventory/demoIssKit";
import pack from "../../knowledge/pack.json";
import sources from "../../knowledge/sources.json";
import { loadCitations, numberMarkers, resolveCitations } from "./citations";
import { REJECTED_LINE } from "./copy";
import { liveProvider } from "./providers";
import { NotInResearch, RejectedItems, ResearchReply } from "./ReplyParts";
import { validateRecommendation } from "./validate";

type SourceRow = { url: string | null; title: string; section?: string };
const SOURCES = sources as Record<string, SourceRow>;
const HR_CHUNK = "cv:space-motion-sickness:heartrate.2";
const NOT_FOUND_TEXT = "Not in Pulseframe research. Contact the flight surgeon.";

function chunk(id: string) {
  const row = pack.find((c) => c.id === id);
  if (!row) throw new Error(`missing chunk ${id}`);
  return row;
}

function stubAssistant(body: unknown) {
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify(body), { status: 200 }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cited live answer", () => {
  it("links each citation chip to the chunk's source url", async () => {
    const expected = chunk(HR_CHUNK).cite.map((id) => SOURCES[id]!.url);
    expect(expected.every((url) => typeof url === "string" && url.startsWith("https://"))).toBe(true);

    stubAssistant({
      text: `Mean 24 h heart rate is unchanged in flight [${HR_CHUNK}].`,
      citations: [HR_CHUNK],
      notFound: false,
    });
    const reply = await liveProvider.ask({ command: "what is normal in-flight heart rate?", inventory: [] });
    const citations = await loadCitations(reply.citations ?? []);
    const html = renderToStaticMarkup(createElement(ResearchReply, { text: reply.text, citations }));

    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!.replace(/&amp;/g, "&"));
    expect(hrefs).toEqual(expected);
    expect(html).toContain("unchanged in flight [1].");
    expect(html).not.toContain(HR_CHUNK);
    expect(html).toContain('target="_blank"');
  });

  it("numbers shared sources once and drops chunks or sources it cannot link", () => {
    const multi = pack.find((c) => c.cite.length > 1 && c.cite.every((id) => SOURCES[id]?.url))!;
    const noUrl = pack.find((c) => c.cite.every((id) => !SOURCES[id]?.url))!;
    const tables = buildCitationIndex(pack, SOURCES);
    const resolved = resolveCitations([multi.id, multi.id, "made:up", noUrl.id], tables);
    expect(resolved.sources.map((s) => s.id)).toEqual(multi.cite);
    expect(resolved.sources.map((s) => s.n)).toEqual(multi.cite.map((_, i) => i + 1));
    expect(Object.keys(resolved.byChunk)).toEqual([multi.id]);
    expect(numberMarkers(`A [${multi.id}]. B [made:up]. C [${noUrl.id}].`, resolved.byChunk)).toBe(
      `A [${multi.cite.map((_, i) => i + 1).join(", ")}]. B. C.`,
    );
  });

  it("keeps the client index far smaller than the raw pack", () => {
    const index = JSON.stringify(buildCitationIndex(pack, SOURCES));
    expect(index.length).toBeLessThan(JSON.stringify(pack).length / 3);
    for (const [id, row] of Object.entries(buildCitationIndex(pack, SOURCES).sources)) {
      expect(row[0], id).toBe(SOURCES[id]!.url);
    }
  });
});

describe("not in research", () => {
  it("shows only the server line and no source links", async () => {
    stubAssistant({ text: NOT_FOUND_TEXT, citations: [], notFound: true });
    const reply = await liveProvider.ask({ command: "how do I treat appendicitis?", inventory: [] });
    expect(reply.notFound).toBe(true);
    const citations = await loadCitations(reply.citations ?? []);
    expect(citations.sources).toEqual([]);
    const html = renderToStaticMarkup(createElement(NotInResearch, { text: reply.text }));
    expect(html).toContain(NOT_FOUND_TEXT);
    expect(html).not.toContain("<a");
  });
});

describe("live draft guardrail", () => {
  it("rejects an invented item id and shows the rejected line", async () => {
    stubAssistant({
      text: "Headache in flight is often linked to CO2 [cond:headache-co2].",
      citations: ["cond:headache-co2"],
      draft: { itemIds: ["kit-white-aspirin", "kit-invented-morphine"], rationale: "r", cautions: "c" },
      notFound: false,
    });
    const reply = await liveProvider.ask({ command: "what helps a headache?", inventory: DEMO_ISS_KIT_SUBSET });
    const result = validateRecommendation(reply.draft, DEMO_ISS_KIT_SUBSET, "case-1", false);
    expect(result.recommendation?.itemIds).toEqual(["kit-white-aspirin"]);
    expect(result.rejectedItemIds).toEqual(["kit-invented-morphine"]);

    const html = renderToStaticMarkup(createElement(RejectedItems, { ids: result.rejectedItemIds }));
    expect(html).toContain(REJECTED_LINE);
    expect(html).toContain("kit-invented-morphine");
    expect(renderToStaticMarkup(createElement(RejectedItems, { ids: [] }))).toBe("");
  });
});
