import { describe, expect, it } from "vitest";
import {
  DEFAULT_BUDGET_TOKENS,
  KEY_BOOST,
  PACK,
  PROTOCOL_BOOST,
  REGION_BOOST,
  createRetriever,
  detectKeys,
  estimateTokens,
  formatChunkLine,
  retrieve,
  tokenize,
  type KnowledgeChunk,
} from "./retrieve.ts";

function chunk(id: string, text: string, extra: Partial<KnowledgeChunk> = {}): KnowledgeChunk {
  return { id, kind: "condition", topic: "misc", keys: [], text, cite: ["S1"], ...extra };
}

describe("tokenize and detectKeys", () => {
  it("lowercases, drops stopwords and joins hyphenated words", () => {
    expect(tokenize("What is the normal In-Flight heart rate?")).toEqual(["normal", "flight", "inflight", "heart", "rate"]);
  });

  it("finds measurement keys by name, label and alias", () => {
    expect(detectKeys("what is normal in-flight heart rate?")).toEqual(["heartRate"]);
    expect(detectKeys("is a pulse of 110 high")).toEqual(["heartRate"]);
    expect(detectKeys("blood pressure after EVA")).toEqual(["systolicBP", "diastolicBP"]);
    expect(detectKeys("SpO2 dropped")).toEqual(["oxygenSat"]);
    expect(detectKeys("oxygenSat trend")).toEqual(["oxygenSat"]);
    expect(detectKeys("my hrv is odd")).toEqual([]);
  });
});

describe("retrieve over the research pack", () => {
  it("indexes every pack chunk", () => {
    expect(PACK.length).toBeGreaterThan(700);
  });

  it("ranks a heartRate baseline chunk first for normal in-flight heart rate", () => {
    const result = retrieve({ question: "what is normal in-flight heart rate?" });
    const top = result.chunks[0].chunk;
    expect(top.kind).toBe("baseline");
    expect(top.keys).toContain("heartRate");
    expect(result.keys).toEqual(["heartRate"]);
  });

  it("ranks choking-airway protocol chunks high for a choking case", () => {
    const result = retrieve({
      question: "crewmate is choking and cannot speak, what do I do?",
      protocolId: "choking-airway",
      regionIds: ["head", "chest"],
    });
    const topIds = result.chunks.slice(0, 5).map((c) => c.chunk.id);
    expect(topIds[0]).toMatch(/^proto:choking-airway/);
    expect(topIds.filter((id) => id.startsWith("proto:choking-airway")).length).toBeGreaterThanOrEqual(3);
    expect(result.ids.has("proto:choking-airway:steps")).toBe(true);
  });

  it("brings in the case protocol even when the question shares no words with it", () => {
    const result = retrieve({ question: "zzzz?", protocolId: "eye-foreign-body-abrasion" });
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks.every((c) => c.chunk.topic === "eye-foreign-body-abrasion")).toBe(true);
  });

  it("returns nothing for a question with no matching terms and no case", () => {
    const result = retrieve({ question: "zzzz qqqq" });
    expect(result.chunks).toEqual([]);
    expect(result.ids.size).toBe(0);
    expect(result.usedTokens).toBe(0);
  });

  it("never exceeds the budget, for the default and for small budgets", () => {
    const questions = [
      "what is normal in-flight heart rate?",
      "burn from a fire with smoke in the cabin",
      "radiation dose limits and sleep and stress and blood pressure",
    ];
    for (const question of questions) {
      for (const budgetTokens of [undefined, 1500, 400, 130, 50, 0]) {
        const result = retrieve({ question, budgetTokens });
        const limit = budgetTokens ?? DEFAULT_BUDGET_TOKENS;
        const sum = result.chunks.reduce((n, c) => n + c.tokens, 0);
        expect(sum).toBe(result.usedTokens);
        expect(result.usedTokens).toBeLessThanOrEqual(limit);
        for (const c of result.chunks) expect(c.tokens).toBe(estimateTokens(formatChunkLine(c.chunk)));
      }
    }
  });

  it("fills most of the default budget for a broad question", () => {
    const result = retrieve({ question: "heart rate blood pressure sleep stress radiation" });
    expect(result.usedTokens).toBeGreaterThan(DEFAULT_BUDGET_TOKENS - 150);
  });

  it("returns chunks in score order and the same result every time", () => {
    const query = { question: "headache and CO2 in the cabin", protocolId: "headache-co2", regionIds: ["head"] };
    const first = retrieve(query);
    const second = retrieve(query);
    expect(second.chunks.map((c) => c.chunk.id)).toEqual(first.chunks.map((c) => c.chunk.id));
    for (let i = 1; i < first.chunks.length; i++) {
      expect(first.chunks[i - 1].score).toBeGreaterThanOrEqual(first.chunks[i].score);
    }
    expect([...first.ids]).toEqual(first.chunks.map((c) => c.chunk.id));
  });
});

describe("boosts and budget policy (small pack)", () => {
  const pack: KnowledgeChunk[] = [
    chunk("a", "nausea after waking"),
    chunk("b", "nausea and vomiting", { topic: "space-motion-sickness" }),
    chunk("c", "regions: leftArm|rightArm", { topic: "sprain" }),
    chunk("d", "joint swelling", { topic: "sprain" }),
    chunk("e", "resting value", { keys: ["heartRate"] }),
    chunk("f", "unrelated filler text"),
  ];
  const retriever = createRetriever(pack);

  it("adds the protocol boost to chunks whose topic is the case protocol", () => {
    const plain = retriever.retrieve({ question: "nausea" });
    const boosted = retriever.retrieve({ question: "nausea", protocolId: "space-motion-sickness" });
    const score = (r: typeof plain, id: string) => r.chunks.find((c) => c.chunk.id === id)?.score ?? 0;
    expect(score(boosted, "b") - score(plain, "b")).toBeCloseTo(PROTOCOL_BOOST);
    expect(score(boosted, "a")).toBeCloseTo(score(plain, "a"));
    expect(boosted.chunks[0].chunk.id).toBe("b");
  });

  it("boosts every chunk of a topic whose regions line names a case region", () => {
    const result = retriever.retrieve({ question: "anything", regionIds: ["leftArm"] });
    expect(result.chunks.map((c) => c.chunk.id)).toEqual(["c", "d"]);
    expect(result.chunks.every((c) => c.score === REGION_BOOST)).toBe(true);
  });

  it("boosts chunks carrying a measurement key named in the question", () => {
    const result = retriever.retrieve({ question: "what is my pulse" });
    expect(result.chunks[0].chunk.id).toBe("e");
    expect(result.chunks[0].score).toBeGreaterThanOrEqual(KEY_BOOST);
  });

  it("skips a chunk that does not fit and keeps trying smaller lower-ranked ones", () => {
    const big = chunk("big", "alpha " + "x".repeat(400));
    const small = chunk("small", "alpha beta");
    const r = createRetriever([chunk("top", "alpha alpha alpha beta beta"), big, small]);
    const budgetTokens = estimateTokens(formatChunkLine(pack[0])) + 20;
    const result = r.retrieve({ question: "alpha beta", budgetTokens });
    expect(result.ids.has("big")).toBe(false);
    expect(result.ids.has("small")).toBe(true);
    expect(result.usedTokens).toBeLessThanOrEqual(budgetTokens);
  });

  it("breaks score ties by pack order", () => {
    const r = createRetriever([chunk("x2", "same words"), chunk("x1", "same words")]);
    expect(r.retrieve({ question: "same words" }).chunks.map((c) => c.chunk.id)).toEqual(["x2", "x1"]);
  });
});
