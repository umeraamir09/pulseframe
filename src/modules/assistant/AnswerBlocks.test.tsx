import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnswerBlockView, AnswerBlocks, CiteRefs } from "./AnswerBlocks";
import { blockCitations, parseBlocks, type AnswerBlock } from "./answerBlocks";
import { AstronautAvatar } from "./AstronautAvatar";
import { GENERAL_NOTE } from "./copy";
import { LiveAnswer } from "./ReplyParts";

const byChunk = { "cv:a": [1], "cv:b": [2, 1] };
const render = (block: AnswerBlock) => renderToStaticMarkup(createElement(AnswerBlockView, { block, byChunk }));

const RANGE: AnswerBlock = { type: "range", label: "Resting heart rate", low: 60, high: 100, unit: "bpm", note: "Unchanged in flight", cite: ["cv:a"] };
const LIST: AnswerBlock = { type: "list", title: "Try asking", items: [{ text: "What is normal heart rate?", cite: [] }] };

describe("answer blocks", () => {
  it("draws a range bar with both bounds, the unit and its source number", () => {
    const html = render(RANGE);
    expect(html).toContain("60–100 bpm");
    expect(html).toContain('aria-label="Resting heart rate: 60–100 bpm"');
    expect(html).toContain("<sup>1</sup>");
    expect(html).toContain("Unchanged in flight");
  });

  it("shows an open bound as at least or at most", () => {
    expect(render({ ...RANGE, high: null } as AnswerBlock)).toContain("≥ 60 bpm");
    expect(render({ ...RANGE, low: null, high: 37.5, unit: "°C" } as AnswerBlock)).toContain("≤ 37.5 °C");
  });

  it("numbers steps and shows warnings as a callout", () => {
    const steps = render({
      type: "steps",
      title: "Do now",
      items: [
        { title: "Stop exercise", detail: "Sit and rest", cite: ["cv:a"] },
        { title: "Recheck vitals", detail: "", cite: ["cv:b"] },
      ],
    });
    expect(steps).toMatch(/step-n[^>]*>1<.*Stop exercise.*step-n[^>]*>2<.*Recheck vitals/s);
    const warn = render({ type: "warning", title: "Call the flight surgeon if", items: ["Chest pain"], cite: ["cv:b"] });
    expect(warn).toContain('role="note"');
    expect(warn).toContain("Chest pain");
    expect(warn).toContain("<sup>1</sup><sup>2</sup>");
  });

  it("lays facts out as label/value pairs", () => {
    const html = render({ type: "facts", title: "", items: [{ label: "Typical", value: "60 bpm", cite: ["cv:a"] }] });
    expect(html).toContain("<dt>Typical</dt>");
    expect(html).toContain("60 bpm");
  });

  it("shows no source numbers for uncited or unknown chunks", () => {
    expect(renderToStaticMarkup(createElement(CiteRefs, { cite: ["cv:zz"], byChunk }))).toBe("");
    expect(render(LIST)).not.toContain("<sup>");
  });

  it("parses only known block shapes and collects their citations", () => {
    const blocks = parseBlocks([RANGE, { type: "chart" }, LIST, "x", null]);
    expect(blocks).toEqual([RANGE, LIST]);
    expect(parseBlocks("nope")).toEqual([]);
    expect(blockCitations([RANGE, { type: "list", title: "", items: [{ text: "t", cite: ["cv:b", "cv:a"] }] }])).toEqual(["cv:a", "cv:b"]);
  });

  it("staggers blocks only when revealing a new answer", () => {
    expect(renderToStaticMarkup(createElement(AnswerBlocks, { blocks: [RANGE, LIST], byChunk, reveal: true }))).toContain(
      "animation-delay:90ms",
    );
    expect(renderToStaticMarkup(createElement(AnswerBlocks, { blocks: [RANGE], byChunk, reveal: false }))).not.toContain("reveal");
  });
});

describe("LiveAnswer", () => {
  const citations = {
    sources: [{ id: "S1", n: 1, url: "https://example.org/hr", title: "Heart rate study", section: "" }],
    byChunk: { "cv:a": [1] },
  };

  it("shows the lead text with numbered markers, blocks and source chips", () => {
    const html = renderToStaticMarkup(
      createElement(LiveAnswer, { kind: "research", text: "Heart rate is unchanged [cv:a].", citations, blocks: [RANGE] }),
    );
    expect(html).toContain("Heart rate is unchanged [1].");
    expect(html).toContain("60–100 bpm");
    expect(html).toContain('href="https://example.org/hr"');
    expect(html).not.toContain(GENERAL_NOTE);
  });

  it("labels a general answer as not from research and shows no source chips", () => {
    const html = renderToStaticMarkup(
      createElement(LiveAnswer, { kind: "general", text: "Hello!", citations: { sources: [], byChunk: {} }, blocks: [LIST] }),
    );
    expect(html).toContain("Hello!");
    expect(html).toContain(GENERAL_NOTE);
    expect(html).toContain("Try asking");
    expect(html).not.toContain("<a ");
  });

  it("starts typing a new answer from empty, with a caret and no blocks yet", () => {
    const html = renderToStaticMarkup(
      createElement(LiveAnswer, { kind: "research", text: "Heart rate [cv:a].", citations, blocks: [RANGE], animate: true }),
    );
    expect(html).toContain('class="caret"');
    expect(html).not.toContain("Heart rate");
    expect(html).not.toContain("60–100");
  });
});

describe("AstronautAvatar", () => {
  it("renders the still image when 3D is unavailable, with an accessible label", () => {
    const html = renderToStaticMarkup(createElement(AstronautAvatar, { pose: "type", label: "Astronaut typing" }));
    expect(html).toContain('aria-label="Astronaut typing"');
    expect(html).toContain('src="/mascot.jpg"');
    expect(html).toContain("pose-type");
  });
});
