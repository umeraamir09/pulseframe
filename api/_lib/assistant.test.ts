import { describe, expect, it, vi } from "vitest";
import handler, { handleAssistant, isDevelopment } from "../assistant.ts";
import { NOT_FOUND_TEXT } from "./assistantPrompt.ts";
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

const retrievedIds = [...retrieve({ question: QUESTION }).ids];

describe("POST /api/assistant", () => {
  it("returns a cited answer and drops citations outside the retrieved set", async () => {
    expect(retrievedIds.length).toBeGreaterThan(0);
    const good = retrievedIds[0]!;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      groqOk({ text: `Resting heart rate stays in range [${good}] [cond:invented].`, citations: [good, "cond:invented"], draft: null, notFound: false }),
    );
    const res = await handleAssistant(post({ command: QUESTION, inventoryIds: [] }), { env: PROD, fetch: fetchMock });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ text: `Resting heart rate stays in range [${good}].`, citations: [good], notFound: false });
    expect(body).not.toHaveProperty("usage");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(GROQ_CHAT_URL);
    const sent = JSON.parse(String(init?.body)) as Record<string, unknown> & { messages: Array<{ content: string }> };
    expect(sent.reasoning_effort).toBe("low");
    expect(sent.max_completion_tokens).toBe(600);
    expect(sent.temperature).toBe(0.2);
    expect((sent.response_format as { type: string }).type).toBe("json_schema");
    expect(sent.messages).toHaveLength(2);
    expect(sent.messages[1]!.content).toContain(`[${good}]`);
  });

  it("returns usage in development only", async () => {
    const good = retrievedIds[0]!;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(groqOk({ text: `ok [${good}]`, citations: [good], draft: null, notFound: false }));
    const res = await handleAssistant(post({ command: QUESTION }), { env: DEV, fetch: fetchMock });
    const body = (await res.json()) as { usage: { prompt_tokens: number; estimatedInputTokens: number } };
    expect(body.usage.prompt_tokens).toBe(1800);
    expect(body.usage.estimatedInputTokens).toBeGreaterThan(0);
    expect(body.usage.estimatedInputTokens).toBeLessThanOrEqual(3000);
  });

  it("passes the model's notFound through with the fixed text", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      groqOk({ text: "Appendicitis needs surgery.", citations: [], draft: null, notFound: true }),
    );
    const res = await handleAssistant(post({ command: "how do I treat appendicitis?" }), { env: PROD, fetch: fetchMock });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: NOT_FOUND_TEXT, citations: [], notFound: true });
  });

  it("answers notFound without calling Groq when nothing is retrieved", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const res = await handleAssistant(post({ command: "zzqx qqzv" }), { env: PROD, fetch: fetchMock });
    expect(await res.json()).toEqual({ text: NOT_FOUND_TEXT, citations: [], notFound: true });
    expect(fetchMock).not.toHaveBeenCalled();
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
