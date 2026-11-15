import { describe, expect, it } from "vitest";
import { MEASUREMENT_KEYS } from "../../src/contracts/keys.ts";
import { HEADLINE_MAX_WORDS } from "../../src/modules/dashboard/briefCopy.ts";
import type { BriefSummary } from "../../src/modules/dashboard/briefSummary.ts";
import {
  BRIEF_CONTEXT_BUDGET_TOKENS,
  BRIEF_KINDS,
  BRIEF_RESPONSE_FORMAT,
  BRIEF_SYSTEM_PROMPT,
  BriefOutputError,
  MAX_INPUT_TOKENS,
  buildBriefPrompt,
  finalizeBrief,
  formatSummary,
  noteArrow,
  retrieveForBrief,
} from "./briefPrompt.ts";
import { PACK, estimateTokens, type RetrieveResult, type RetrievedChunk } from "./retrieve.ts";

const SUMMARY: BriefSummary = {
  days: 7,
  openAlerts: { watch: 1, act: 1, keys: ["heartRate", "sleepHours"] },
  metrics: [
    { key: "heartRate", n: 7, mean: 64.67, last: 70, baseMean: 62, baseStd: 4, z: 2 },
    { key: "sleepHours", n: 7, mean: 6.1, last: 4.2, baseMean: 6.8, baseStd: 0.5, z: -5.2 },
  ],
  checklist: { done: 4, total: 9 },
  radiationWeekMgy: 0.95,
};

/** Every key with the longest numbers the schema would plausibly carry. */
const WORST: BriefSummary = {
  days: 31,
  openAlerts: { watch: 999, act: 999, keys: [...MEASUREMENT_KEYS] },
  metrics: MEASUREMENT_KEYS.map((key) => ({ key, n: 9999, mean: -12345.67, last: -12345.67, baseMean: -12345.67, baseStd: 12345.67, z: -12345.67 })),
  checklist: { done: 999, total: 999 },
  radiationWeekMgy: -12345.678,
};

function fullContext(): RetrieveResult {
  const chunks: RetrievedChunk[] = [];
  let used = 0;
  for (const chunk of [...PACK].sort((a, b) => b.text.length - a.text.length)) {
    const tokens = estimateTokens(`[${chunk.id}] ${chunk.text}`);
    if (used + tokens > BRIEF_CONTEXT_BUDGET_TOKENS) continue;
    chunks.push({ chunk, score: 1, tokens });
    used += tokens;
  }
  return { chunks, ids: new Set(chunks.map((c) => c.chunk.id)), usedTokens: used, budgetTokens: BRIEF_CONTEXT_BUDGET_TOKENS, keys: [] };
}

const note = (over: Record<string, unknown>) => ({
  key: "heartRate",
  status: "watch",
  headline: "Above your normal",
  action: "",
  why: "",
  cite: ["base:a"],
  ...over,
});

describe("brief prompt builder", () => {
  it(`keeps worst-case input under ${MAX_INPUT_TOKENS} tokens`, () => {
    const prompt = buildBriefPrompt(WORST, fullContext());
    expect(prompt.estimatedTokens).toBeLessThanOrEqual(MAX_INPUT_TOKENS);
    const chars = prompt.messages.reduce((s, msg) => s + msg.content.length, 0);
    expect(Math.ceil(chars / 4)).toBeLessThanOrEqual(MAX_INPUT_TOKENS);
    expect(formatSummary(WORST).split("\n").filter((l) => l.includes("|")).length).toBe(MEASUREMENT_KEYS.length + 1);
  });

  it("keeps the system prompt byte-stable and free of per-request data", () => {
    const a = buildBriefPrompt(SUMMARY, retrieveForBrief(SUMMARY));
    const b = buildBriefPrompt(WORST, retrieveForBrief(WORST));
    expect(a.messages[0]!.content).toBe(BRIEF_SYSTEM_PROMPT);
    expect(b.messages[0]!.content).toBe(BRIEF_SYSTEM_PROMPT);
    expect(BRIEF_SYSTEM_PROMPT).toMatch(/dose/i);
    expect(BRIEF_SYSTEM_PROMPT).toMatch(/not a diagnosis/i);
    expect(BRIEF_SYSTEM_PROMPT).toMatch(/8 words/);
    expect(BRIEF_SYSTEM_PROMPT).not.toMatch(/[—–]/);
    const schema = JSON.stringify(BRIEF_RESPONSE_FORMAT);
    expect(schema).toContain("notes");
    expect(schema).not.toContain("bullets");
  });

  it("puts only the numeric summary and retrieved chunks in the user message", () => {
    const retrieved = retrieveForBrief(SUMMARY);
    const user = buildBriefPrompt(SUMMARY, retrieved).messages[1]!.content;
    expect(user).toContain("heartRate|bpm|7|64.67|70|62|4|2");
    expect(user).toContain("radiation this week: 0.95 mGy");
    for (const { chunk } of retrieved.chunks) expect(user).toContain(`[${chunk.id}]`);
  });
});

describe("retrieveForBrief", () => {
  it("returns baseline and spaceflight-factor chunks for the keys involved, within budget", () => {
    const r = retrieveForBrief(SUMMARY);
    expect(r.usedTokens).toBeLessThanOrEqual(BRIEF_CONTEXT_BUDGET_TOKENS);
    expect(r.chunks.every(({ chunk }) => BRIEF_KINDS.has(chunk.kind))).toBe(true);
    const kinds = new Set(r.chunks.map(({ chunk }) => chunk.kind));
    expect(kinds.has("baseline")).toBe(true);
    expect(kinds.has("spaceflight-factor")).toBe(true);
    const ids = r.chunks.map(({ chunk }) => chunk.id);
    expect(ids.some((id) => id.startsWith("base:heartrate"))).toBe(true);
    expect(ids.some((id) => id.startsWith("base:sleephours"))).toBe(true);
  });
});

describe("noteArrow", () => {
  it("points up or down against the personal baseline and stays quiet when flat", () => {
    expect(noteArrow(SUMMARY.metrics[0])).toBe("up");
    expect(noteArrow(SUMMARY.metrics[1])).toBe("down");
    expect(noteArrow({ key: "oxygenSat", n: 3, mean: 98, last: 98, baseMean: 98, baseStd: 1 })).toBeUndefined();
    expect(noteArrow({ key: "oxygenSat", n: 3, mean: 98, last: 98 })).toBeUndefined();
  });
});

describe("finalizeBrief", () => {
  const allowed = new Set(["base:a", "base:b", "factor:c"]);

  it("keeps one plain note per key and drops invented citations", () => {
    const out = finalizeBrief(
      JSON.stringify({
        notes: [
          note({
            headline: "Heart rate is 15 above your normal (z = 5.23) and then some extra words here [base:a] [cond:invented].",
            action: "Tell the flight surgeon",
            why: "Fluid shift loads the heart [factor:c].",
            cite: ["base:a", "cond:invented"],
            status: "act",
          }),
          note({ key: "sleepHours", headline: "Sleep is low [cond:invented].", cite: ["cond:invented"] }),
          note({ key: "oxygenSat", headline: "Steady [factor:c].", action: "", why: "", cite: [] }),
          note({ key: "bloodGlucose", status: "normal", headline: "Right at your normal", cite: ["base:b"] }),
        ],
      }),
      allowed,
      SUMMARY,
    );
    expect(out.notes.map((n) => n.key)).toEqual(["heartRate", "oxygenSat", "bloodGlucose"]);
    const heart = out.notes[0]!;
    expect(heart.status).toBe("act");
    expect(heart.headline.split(/\s+/).length).toBeLessThanOrEqual(HEADLINE_MAX_WORDS);
    expect(heart.headline).not.toMatch(/[—–μσ]|\bz\b|base:/);
    expect(heart.action).toBe("Tell the flight surgeon");
    expect(heart.why).toBe("Fluid shift loads the heart.");
    expect(heart.citations).toEqual(["base:a", "factor:c"]);
    expect(heart.arrow).toBe("up");
    expect(out.notes[1]).toMatchObject({ key: "oxygenSat", headline: "Steady.", citations: ["factor:c"] });
    expect(out.notes[1]!.arrow).toBeUndefined();
    expect(out.notes[2]).toMatchObject({ key: "bloodGlucose", status: "normal", headline: "Right at your normal", citations: ["base:b"] });
  });

  it("drops a medication dose, fills a missing act line, and keeps the worse note for a key", () => {
    const out = finalizeBrief(
      JSON.stringify({
        notes: [
          note({ status: "watch", headline: "A bit high", cite: ["base:a"] }),
          note({ status: "act", headline: "Well above your normal", action: "", cite: ["base:a"] }),
          note({ key: "bloodGlucose", headline: "Take 500 mg now", cite: ["base:b"] }),
          note({ key: "temperatureC", headline: "Up 0.4 from your normal — worth a look", cite: ["factor:c"] }),
        ],
      }),
      allowed,
      SUMMARY,
    );
    expect(out.notes.map((n) => n.key)).toEqual(["heartRate", "temperatureC"]);
    expect(out.notes[0]).toMatchObject({ status: "act", action: "Tell the flight surgeon", arrow: "up" });
    expect(out.notes[1]!.headline).toBe("Up 0.4 from your normal, worth a look");
    expect(JSON.stringify(out)).not.toMatch(/\b500\s?mg\b/);
    expect(JSON.stringify(out)).not.toMatch(/[—–]/);
  });

  it("accepts an empty list and rejects unusable output", () => {
    expect(finalizeBrief(JSON.stringify({ notes: [] }), allowed, SUMMARY)).toEqual({ notes: [] });
    expect(() => finalizeBrief(JSON.stringify({ notes: [note({ headline: "x", cite: ["nope"] })] }), allowed, SUMMARY)).toThrow(BriefOutputError);
    expect(() => finalizeBrief("not json", allowed, SUMMARY)).toThrow(BriefOutputError);
    expect(() => finalizeBrief(JSON.stringify({ bullets: [] }), allowed, SUMMARY)).toThrow(BriefOutputError);
  });
});
