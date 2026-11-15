import { describe, expect, it } from "vitest";
import { MEASUREMENT_KEYS } from "../../src/contracts/keys.ts";
import type { BriefSummary } from "../../src/modules/dashboard/briefSummary.ts";
import {
  BRIEF_CONTEXT_BUDGET_TOKENS,
  BRIEF_KINDS,
  BRIEF_SYSTEM_PROMPT,
  BriefOutputError,
  MAX_BULLETS,
  MAX_INPUT_TOKENS,
  buildBriefPrompt,
  finalizeBrief,
  formatSummary,
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

describe("brief prompt builder", () => {
  it(`keeps worst-case input under ${MAX_INPUT_TOKENS} tokens`, () => {
    const prompt = buildBriefPrompt(WORST, fullContext());
    expect(prompt.estimatedTokens).toBeLessThanOrEqual(MAX_INPUT_TOKENS);
    const chars = prompt.messages.reduce((s, msg) => s + msg.content.length, 0);
    expect(Math.ceil(chars / 4)).toBeLessThanOrEqual(MAX_INPUT_TOKENS);
    // Every key line still fits.
    expect(formatSummary(WORST).split("\n").filter((l) => l.includes("|")).length).toBe(MEASUREMENT_KEYS.length + 1);
  });

  it("keeps the system prompt byte-stable and free of per-request data", () => {
    const a = buildBriefPrompt(SUMMARY, retrieveForBrief(SUMMARY));
    const b = buildBriefPrompt(WORST, retrieveForBrief(WORST));
    expect(a.messages[0]!.content).toBe(BRIEF_SYSTEM_PROMPT);
    expect(b.messages[0]!.content).toBe(BRIEF_SYSTEM_PROMPT);
    expect(BRIEF_SYSTEM_PROMPT).toMatch(/dose/i);
    expect(BRIEF_SYSTEM_PROMPT).toMatch(/not a diagnosis/i);
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

describe("finalizeBrief", () => {
  const allowed = new Set(["base:a", "base:b", "factor:c"]);
  const bullet = (text: string, cite: string[]) => ({ text, cite });

  it("drops citations outside the retrieved set and bullets with none left", () => {
    const out = finalizeBrief(
      JSON.stringify({
        bullets: [
          bullet("Heart rate is above your baseline [base:a] [cond:invented].", ["base:a", "cond:invented"]),
          bullet("Sleep is low [cond:invented].", ["cond:invented"]),
          bullet("Fluid shifts change BP [factor:c].", []),
          bullet("Checklist is behind.", []),
          bullet("Radiation is in range [base:b].", ["base:b"]),
        ],
      }),
      allowed,
    );
    expect(out.bullets).toEqual([
      { text: "Heart rate is above your baseline [base:a].", citations: ["base:a"] },
      { text: "Fluid shifts change BP [factor:c].", citations: ["factor:c"] },
      { text: "Radiation is in range [base:b].", citations: ["base:b"] },
    ]);
  });

  it(`caps at ${MAX_BULLETS} bullets`, () => {
    const many = Array.from({ length: 8 }, (_, i) => bullet(`Point ${i} [base:a].`, ["base:a"]));
    expect(finalizeBrief(JSON.stringify({ bullets: many }), allowed).bullets).toHaveLength(MAX_BULLETS);
  });

  it("throws when fewer than 3 cited bullets survive, or the output is not the schema", () => {
    expect(() => finalizeBrief(JSON.stringify({ bullets: [bullet("x [base:a]", ["base:a"])] }), allowed)).toThrow(BriefOutputError);
    expect(() => finalizeBrief("not json", allowed)).toThrow(BriefOutputError);
    expect(() => finalizeBrief(JSON.stringify({ items: [] }), allowed)).toThrow(BriefOutputError);
  });
});
