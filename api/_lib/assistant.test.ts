import { describe, expect, it, vi } from "vitest";
import handler, { handleAssistant, isDevelopment } from "../assistant.ts";
import { ASSISTANT_MAX_COMPLETION_TOKENS, NOT_FOUND_TEXT } from "./assistantPrompt.ts";
import { GROQ_CHAT_URL } from "./groq.ts";
import { retrieve } from "./retrieve.ts";

const QUESTION = "what is normal in-flight heart rate?";
const PROD = { GROQ_API_KEY: "test-key", VERCEL_ENV: "production" };
const DEV = { GROQ_API_KEY: "test-key", VERCEL_ENV: "development" };

function post(body: unknown): Request {
  return new Request("http://localhost/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function groqOk(answer: unknown): Response {
  return new Response(
    JSON.stringify({
      model: "openai/gpt-oss-120b",
      choices: [{ message: { role: "assistant", content: typeof answer === "string" ? answer : JSON.stringify(answer) }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1800, completion_tokens: 120, total_tokens: 1920 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

/** Same as the liveProvider check: a 2xx with non-empty text is used, anything else falls back offline. */
async function clientWouldFallBack(res: Response): Promise<boolean> {
  if (!res.ok) return true;
  const body = (await res.json()) as { text?: unknown };
  return !(typeof body.text === "string" && body.text.trim().length > 0);
}

const NOT_FOUND_BODY = { kind: "notFound", text: NOT_FOUND_TEXT, citations: [], blocks: [], notFound: true };

const retrievedIds = [...retrieve({ question: QUESTION }).ids];

describe("POST /api/assistant", () => {
  it("returns a cited answer and drops citations outside the retrieved set", async () => {
    expect(retrievedIds.length).toBeGreaterThan(0);
    const good = retrievedIds[0]!;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      groqOk({
        kind: "research",
        text: `Resting heart rate stays in range [${good}] [cond:invented].`,
        citations: [good, "cond:invented"],
        blocks: [],
        draft: null,
      }),
    );
    const res = await handleAssistant(post({ command: QUESTION, inventoryIds: [] }), { env: PROD, fetch: fetchMock });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({
      kind: "research",
      text: `Resting heart rate stays in range [${good}].`,
      citations: [good],
      blocks: [],
      notFound: false,
    });
    expect(body).not.toHaveProperty("usage");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(GROQ_CHAT_URL);
    const sent = JSON.parse(String(init?.body)) as Record<string, unknown> & { messages: Array<{ content: string }> };
    expect(sent.reasoning_effort).toBe("low");
    expect(sent.max_completion_tokens).toBe(ASSISTANT_MAX_COMPLETION_TOKENS);
    expect(sent.temperature).toBe(0.2);
    expect((sent.response_format as { type: string }).type).toBe("json_schema");
    expect(sent.messages).toHaveLength(2);
    expect(sent.messages[1]!.content).toContain(`[${good}]`);
  });

  it("returns usage in development only", async () => {
    const good = retrievedIds[0]!;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(groqOk({ kind: "research", text: `ok [${good}]`, citations: [good], blocks: [], draft: null }));
    const res = await handleAssistant(post({ command: QUESTION }), { env: DEV, fetch: fetchMock });
    const body = (await res.json()) as { usage: { prompt_tokens: number; estimatedInputTokens: number } };
    expect(body.usage.prompt_tokens).toBe(1800);
    expect(body.usage.estimatedInputTokens).toBeGreaterThan(0);
    expect(body.usage.estimatedInputTokens).toBeLessThanOrEqual(3000);
  });

  it("passes the model's notFound through with the fixed text", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      groqOk({ kind: "notFound", text: "Appendicitis needs surgery.", citations: [], blocks: [], draft: null }),
    );
    const res = await handleAssistant(post({ command: "how do I treat appendicitis?" }), { env: PROD, fetch: fetchMock });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(NOT_FOUND_BODY);
  });

  it("asks the model with an empty CONTEXT when nothing is retrieved, so general questions get an answer", async () => {
    expect(retrieve({ question: "hello" }).chunks).toHaveLength(0);
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      groqOk({
        kind: "general",
        text: "Hello! Ask me about crew health or the onboard kit.",
        citations: [],
        blocks: [{ type: "list", title: "Try asking", items: [{ text: "What is normal in-flight heart rate?", cite: [] }] }],
        draft: null,
      }),
    );
    const res = await handleAssistant(post({ command: "hello" }), { env: PROD, fetch: fetchMock });
    expect(await res.json()).toEqual({
      kind: "general",
      text: "Hello! Ask me about crew health or the onboard kit.",
      citations: [],
      blocks: [{ type: "list", title: "Try asking", items: [{ text: "What is normal in-flight heart rate?", cite: [] }] }],
      notFound: false,
    });
    const sent = JSON.parse(String(fetchMock.mock.calls[0]![1]?.body)) as { messages: Array<{ content: string }> };
    expect(sent.messages[1]!.content).toContain("CONTEXT:\nnone");
  });

  it("turns a research answer with nothing retrieved into notFound", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      groqOk({ kind: "research", text: "Made up [cond:x].", citations: ["cond:x"], blocks: [], draft: null }),
    );
    const res = await handleAssistant(post({ command: "zzqx qqzv" }), { env: PROD, fetch: fetchMock });
    expect(await res.json()).toEqual(NOT_FOUND_BODY);
  });

  it("falls back when the key is missing", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const res = await handleAssistant(post({ command: QUESTION }), { env: { VERCEL_ENV: "production" }, fetch: fetchMock });
    expect(res.status).toBe(503);
    expect(await res.clone().json()).toEqual({ error: "missing_key", fallback: true });
    expect(await clientWouldFallBack(res)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back after a 429 and one retry", async () => {
    const limited = () => new Response("slow down", { status: 429, headers: { "retry-after": "0" } });
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => limited());
    const res = await handleAssistant(post({ command: QUESTION }), { env: PROD, fetch: fetchMock });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(503);
    expect(await res.clone().json()).toEqual({ error: "rate_limited", fallback: true });
    expect(await clientWouldFallBack(res)).toBe(true);
  });

  it("falls back on timeout", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const res = await handleAssistant(post({ command: QUESTION }), { env: PROD, fetch: fetchMock, deadlineMs: 30 });
    expect(res.status).toBe(504);
    expect(await res.clone().json()).toEqual({ error: "timeout", fallback: true });
    expect(await clientWouldFallBack(res)).toBe(true);
  });

  it("falls back when the model returns bad JSON or the wrong shape", async () => {
    for (const content of ["not json", '{"text":"t"}']) {
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(groqOk(content));
      const res = await handleAssistant(post({ command: QUESTION }), { env: PROD, fetch: fetchMock });
      expect(res.status).toBe(502);
      expect(await res.clone().json()).toEqual({ error: "bad_model_output", fallback: true });
      expect(await clientWouldFallBack(res)).toBe(true);
    }
  });

  it("routes chest pain to Emergency without calling Groq", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const res = await handleAssistant(post({ command: "I have a hard pain in my chest" }), { env: PROD, fetch: fetchMock });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { kind: string; text: string; redFlag: string; actions: { label: string; to: string }[] };
    expect(body.kind).toBe("emergency");
    expect(body.redFlag).toContain("start CPR");
    expect(body.actions[0]?.label).toBe("Open Emergency");
    expect(body.actions[0]?.to).toContain("/emergency?");
    expect(body.actions[0]?.to).toContain("region=chest");
    expect(body.text).not.toContain(NOT_FOUND_TEXT);
    expect(body.text).not.toMatch(/\u2014/);
  });

  it("keeps a medicine question on the onboard kit and does not call Groq for a dose", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const res = await handleAssistant(post({ command: "what dose of aspirin should I give" }), { env: PROD, fetch: fetchMock });
    expect(fetchMock).not.toHaveBeenCalled();
    const body = (await res.json()) as { kind: string; text: string };
    expect(body.kind).toBe("formulary");
    expect(body.text).toContain("Aspirin");
    expect(body.text).toContain("does not suggest a dose");
    expect(body.text).not.toMatch(/\d+\s*mg/i);
  });

  it("rejects bad request bodies and other methods", async () => {
    expect((await handleAssistant(post("{bad"), { env: PROD })).status).toBe(400);
    expect((await handleAssistant(post({ command: "" }), { env: PROD })).status).toBe(400);
    const get = await handler.fetch(new Request("http://localhost/api/assistant"));
    expect(get.status).toBe(405);
    expect(get.headers.get("allow")).toBe("POST");
  });

  it("never leaks the Groq error body", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response("secret upstream detail", { status: 500 }));
    const res = await handleAssistant(post({ command: QUESTION }), { env: PROD, fetch: fetchMock });
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("secret");
  });
});

describe("isDevelopment", () => {
  it("uses VERCEL_ENV first, then NODE_ENV", () => {
    expect(isDevelopment({ VERCEL_ENV: "production", NODE_ENV: "development" })).toBe(false);
    expect(isDevelopment({ VERCEL_ENV: "preview" })).toBe(true);
    expect(isDevelopment({ VERCEL_ENV: "development" })).toBe(true);
    expect(isDevelopment({ NODE_ENV: "production" })).toBe(false);
    expect(isDevelopment({})).toBe(true);
  });
});
