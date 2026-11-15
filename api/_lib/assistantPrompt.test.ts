import { describe, expect, it } from "vitest";
import { PROTOCOL_CARDS } from "../../src/modules/protocols/index.ts";
import {
  ANSWER_RESPONSE_FORMAT,
  AssistantRequestSchema,
  CONTEXT_BUDGET_TOKENS,
  MAX_INPUT_TOKENS,
  MAX_INVENTORY_LINES,
  ModelOutputError,
  NOT_FOUND_TEXT,
  SERVER_INVENTORY,
  SYSTEM_PROMPT,
  buildPrompt,
  compressCard,
  filterCitations,
  finalizeAnswer,
  formatHistory,
  HISTORY_MAX_TOKENS,
  inventoryIdOfChunk,
  parseModelAnswer,
  type AssistantRequest,
} from "./assistantPrompt.ts";
import { PACK, estimateTokens, retrieve, type RetrieveResult, type RetrievedChunk } from "./retrieve.ts";

const ALL_KIT_IDS = [...SERVER_INVENTORY.keys()];

/** A context of exactly the retrieve budget, led by one inventory chunk per kit item so INVENTORY is as full as it can get. */
function worstCaseRetrieved(): RetrieveResult {
  const invFirst = [
    ...PACK.filter((c) => c.kind === "inventory" && !/\.\d+$/.test(c.id)),
    ...PACK.filter((c) => c.kind !== "inventory").sort((a, b) => b.text.length - a.text.length),
  ];
  const chunks: RetrievedChunk[] = [];
  let used = 0;
  for (const chunk of invFirst) {
    const tokens = estimateTokens(`[${chunk.id}] ${chunk.text}`);
    if (used + tokens > CONTEXT_BUDGET_TOKENS) continue;
    chunks.push({ chunk, score: 1, tokens });
    used += tokens;
  }
  return { chunks, ids: new Set(chunks.map((c) => c.chunk.id)), usedTokens: used, budgetTokens: CONTEXT_BUDGET_TOKENS, keys: [] };
}

function longestCard() {
  return [...PROTOCOL_CARDS].sort((a, b) => compressCard(b).length - compressCard(a).length)[0]!;
}

const WORST_REQUEST: AssistantRequest = AssistantRequestSchema.parse({
  command: "x".repeat(2000),
  caseCtx: {
    caseId: "c".repeat(200),
    crewId: "crew-a",
    narrative: "burn smoke fire ".repeat(300).slice(0, 5000),
    regionIds: ["head", "chest", "abdomen", "spine", "leftArm", "rightArm", "leftLeg", "rightLeg", "skin"],
    protocolId: longestCard().id,
  },
  inventoryIds: ALL_KIT_IDS,
  lastTurn: { question: "q".repeat(5000), answer: "a".repeat(5000) },
});

describe("buildPrompt token budget", () => {
  it("stays at or under 3,000 input tokens in the worst case", () => {
    const retrieved = worstCaseRetrieved();
    expect(retrieved.usedTokens).toBeGreaterThan(CONTEXT_BUDGET_TOKENS - 150);
    const prompt = buildPrompt(WORST_REQUEST, retrieved);
    const counted = prompt.messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
    expect(counted).toBe(prompt.estimatedTokens);
    expect(prompt.estimatedTokens).toBeLessThanOrEqual(MAX_INPUT_TOKENS);
    expect(prompt.inventoryIds.size).toBeGreaterThan(0);
    expect(prompt.inventoryIds.size).toBeLessThanOrEqual(MAX_INVENTORY_LINES);
  });

  it("stays under budget with a real retrieval for a broad question", () => {
    const request = AssistantRequestSchema.parse({ command: "heart rate blood pressure fever headache burn bleeding sleep radiation" });
    const prompt = buildPrompt(request, retrieve({ question: request.command }));
    expect(prompt.estimatedTokens).toBeLessThanOrEqual(MAX_INPUT_TOKENS);
  });

  it("keeps the system prompt fixed and first (cacheable prefix)", () => {
    const a = buildPrompt(WORST_REQUEST, worstCaseRetrieved());
    const b = buildPrompt(AssistantRequestSchema.parse({ command: "hello" }), retrieve({ question: "heart rate" }));
    expect(a.messages[0]).toEqual({ role: "system", content: SYSTEM_PROMPT });
    expect(b.messages[0]!.content).toBe(a.messages[0]!.content);
    expect(SYSTEM_PROMPT).toContain(NOT_FOUND_TEXT);
    expect(a.messages).toHaveLength(2);
  });

  it("sends only card candidates and retrieved inventory items, never the full kit", () => {
    const card = PROTOCOL_CARDS.find((c) => c.candidateItemIds.length > 0)!;
    const request = AssistantRequestSchema.parse({
      command: "what helps",
      caseCtx: { caseId: "c1", crewId: "crew-a", narrative: "", regionIds: [], protocolId: card.id },
      inventoryIds: ALL_KIT_IDS,
    });
    const retrieved: RetrieveResult = { chunks: [], ids: new Set(), usedTokens: 0, budgetTokens: 1500, keys: [] };
    const prompt = buildPrompt(request, retrieved);
    expect([...prompt.inventoryIds].sort()).toEqual([...new Set(card.candidateItemIds)].filter((id) => SERVER_INVENTORY.has(id)).sort());
    expect(prompt.inventoryIds.size).toBeLessThan(ALL_KIT_IDS.length);
    const user = prompt.messages[1]!.content;
    for (const id of prompt.inventoryIds) {
      const row = SERVER_INVENTORY.get(id)!;
      expect(user).toContain(`${row.id}|${row.name}|${row.route}|`);
    }
  });

  it("leaves out items the client did not list as onboard", () => {
    const card = PROTOCOL_CARDS.find((c) => c.candidateItemIds.length > 0)!;
    const request = AssistantRequestSchema.parse({
      command: "what helps",
      caseCtx: { caseId: "c1", crewId: "crew-a", narrative: "", regionIds: [], protocolId: card.id },
      inventoryIds: [],
    });
    const prompt = buildPrompt(request, { chunks: [], ids: new Set(), usedTokens: 0, budgetTokens: 1500, keys: [] });
    expect(prompt.inventoryIds.size).toBe(0);
  });

  it("compresses the card to title, red flags and step titles only", () => {
    const card = longestCard();
    const text = compressCard(card);
    expect(text).toContain(card.title);
    for (const step of card.immediateSteps) expect(text).not.toContain(step.instruction);
  });

  it("trims the last Q/A pair to 200 tokens", () => {
    const history = formatHistory({ question: "q".repeat(5000), answer: "a".repeat(5000) })!;
    expect(estimateTokens(history)).toBeLessThanOrEqual(HISTORY_MAX_TOKENS);
    expect(formatHistory(undefined)).toBeUndefined();
  });

  it("maps inventory chunk ids to kit ids", () => {
    expect(inventoryIdOfChunk("inv:kit-white-olopatadine")).toBe("kit-white-olopatadine");
    expect(inventoryIdOfChunk("inv:kit-white-olopatadine.2")).toBe("kit-white-olopatadine");
    expect(inventoryIdOfChunk("cond:x")).toBeUndefined();
  });
});

describe("filterCitations", () => {
  const allowed = new Set(["cv:a", "base:b"]);

  it("drops citations outside the retrieved set", () => {
    const out = filterCitations("HR is 60 [cv:a].", ["cv:a", "cond:invented", "base:b", "cv:a"], allowed);
    expect(out.citations).toEqual(["cv:a", "base:b"]);
  });

  it("adds inline ids in the set and strips inline ids outside it", () => {
    const out = filterCitations("Normal [base:b]. Also [cond:made-up].", [], allowed);
    expect(out.citations).toEqual(["base:b"]);
    expect(out.text).toBe("Normal [base:b]. Also.");
  });
});

describe("finalizeAnswer", () => {
  const allowed = new Set(["cv:a"]);

  it("forces the fixed text when notFound", () => {
    const out = finalizeAnswer({ text: "guess", citations: ["cv:a"], draft: null, notFound: true }, allowed);
    expect(out).toEqual({ text: NOT_FOUND_TEXT, citations: [], notFound: true });
  });

  it("turns an answer with no valid citation into notFound", () => {
    const out = finalizeAnswer({ text: "Appendicitis is treated by [cond:fake].", citations: ["cond:fake"], notFound: false }, allowed);
    expect(out.notFound).toBe(true);
    expect(out.text).toBe(NOT_FOUND_TEXT);
  });

  it("passes draft ids on for the client's validateRecommendation to gate", () => {
    const out = finalizeAnswer(
      {
        text: "Use the kit item [cv:a].",
        citations: ["cv:a"],
        draft: { itemIds: ["kit-white-olopatadine", "kit-invented", "kit-invented"], rationale: "r", cautions: "c" },
        notFound: false,
      },
      allowed,
    );
    expect(out.draft).toEqual({ itemIds: ["kit-white-olopatadine", "kit-invented"], rationale: "r", cautions: "c" });
  });

  it("drops an empty or null draft", () => {
    expect(finalizeAnswer({ text: "ok [cv:a]", citations: [], draft: null, notFound: false }, allowed).draft).toBeUndefined();
    expect(
      finalizeAnswer({ text: "ok [cv:a]", citations: [], draft: { itemIds: [], rationale: "", cautions: "" }, notFound: false }, allowed)
        .draft,
    ).toBeUndefined();
  });
});

describe("parseModelAnswer", () => {
  it("accepts a valid answer, with or without a draft", () => {
    expect(parseModelAnswer('{"text":"t","citations":["cv:a"],"draft":null,"notFound":false}').text).toBe("t");
    const withDraft = parseModelAnswer(
      '{"text":"t","citations":[],"draft":{"itemIds":["k"],"rationale":"r","cautions":"c"},"notFound":false}',
    );
    expect(withDraft.draft?.itemIds).toEqual(["k"]);
  });

  it("rejects missing fields", () => {
    expect(() => parseModelAnswer('{"text":"t","citations":[]}')).toThrow(ModelOutputError);
    expect(() => parseModelAnswer('{"citations":[],"notFound":false}')).toThrow(ModelOutputError);
    expect(() => parseModelAnswer('{"text":"t","citations":[],"draft":{"itemIds":["k"]},"notFound":false}')).toThrow(
      ModelOutputError,
    );
  });

  it("rejects bad JSON and wrong types", () => {
    expect(() => parseModelAnswer("not json {")).toThrow(ModelOutputError);
    expect(() => parseModelAnswer('{"text":1,"citations":[],"notFound":false}')).toThrow(ModelOutputError);
    expect(() => parseModelAnswer("[]")).toThrow(ModelOutputError);
  });

  it("keeps the strict response schema in line with the parser", () => {
    const schema = ANSWER_RESPONSE_FORMAT.json_schema;
    expect(schema.strict).toBe(true);
    expect(schema.schema.required).toEqual(["text", "citations", "draft", "notFound"]);
    expect(schema.schema.additionalProperties).toBe(false);
  });
});

describe("AssistantRequestSchema", () => {
  it("accepts what liveProvider posts today", () => {
    const ok = AssistantRequestSchema.safeParse({
      command: "what is normal heart rate?",
      caseCtx: { caseId: "c1", crewId: "crew-a", narrative: "headache", regionIds: ["head"] },
      inventoryIds: ["kit-white-olopatadine"],
    });
    expect(ok.success).toBe(true);
  });

  it("rejects an empty command, unknown regions and oversize input", () => {
    expect(AssistantRequestSchema.safeParse({ command: "  " }).success).toBe(false);
    expect(
      AssistantRequestSchema.safeParse({
        command: "q",
        caseCtx: { caseId: "c", crewId: "a", narrative: "", regionIds: ["tail"] },
      }).success,
    ).toBe(false);
    expect(AssistantRequestSchema.safeParse({ command: "q".repeat(2001) }).success).toBe(false);
  });
});
