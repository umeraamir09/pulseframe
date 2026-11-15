import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_GROQ_MODEL,
  GROQ_CHAT_URL,
  GROQ_DEADLINE_MS,
  GroqBadResponseError,
  GroqError,
  GroqHttpError,
  GroqMissingKeyError,
  GroqRateLimitError,
  GroqTimeoutError,
  groqChat,
  parseRetryAfter,
  type GroqChatRequest,
} from "./groq.ts";

const ENV = { GROQ_API_KEY: "test-key" };

const REQUEST: GroqChatRequest = {
  messages: [
    { role: "system", content: "sys" },
    { role: "user", content: "hi" },
  ],
  response_format: {
    type: "json_schema",
    json_schema: { name: "answer", strict: true, schema: { type: "object", properties: {}, additionalProperties: false } },
  },
  reasoning_effort: "low",
  max_completion_tokens: 600,
  temperature: 0.2,
};

function ok(content = '{"text":"hello"}'): Response {
  return new Response(
    JSON.stringify({
      model: DEFAULT_GROQ_MODEL,
      choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }],
      usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function tooMany(retryAfter?: string): Response {
  const headers: Record<string, string> = {};
  if (retryAfter !== undefined) headers["retry-after"] = retryAfter;
  return new Response('{"error":{"message":"rate limited"}}', { status: 429, headers });
}

/** A fetch that never resolves on its own and rejects when its signal aborts, like the real one. */
function hangingFetch() {
  return vi.fn((_url: string | URL | Request, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    });
  });
}

describe("groqChat", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("posts the request with the key and default model and returns content and usage", async () => {
    const fetchMock = vi.fn(async () => ok());
    const result = await groqChat(REQUEST, { env: ENV, fetch: fetchMock });

    expect(result).toEqual({
      content: '{"text":"hello"}',
      usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 },
      model: DEFAULT_GROQ_MODEL,
      finishReason: "stop",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(GROQ_CHAT_URL);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    const sent = JSON.parse(String(init.body));
    expect(sent).toEqual({ ...REQUEST, model: DEFAULT_GROQ_MODEL });
  });

  it("uses GROQ_MODEL when set", async () => {
    const fetchMock = vi.fn(async () => ok());
    await groqChat(REQUEST, { env: { ...ENV, GROQ_MODEL: "openai/gpt-oss-20b" }, fetch: fetchMock });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).model).toBe("openai/gpt-oss-20b");
  });

  it("throws GroqMissingKeyError without calling fetch when the key is missing or blank", async () => {
    const fetchMock = vi.fn(async () => ok());
    await expect(groqChat(REQUEST, { env: {}, fetch: fetchMock })).rejects.toBeInstanceOf(GroqMissingKeyError);
    await expect(groqChat(REQUEST, { env: { GROQ_API_KEY: "  " }, fetch: fetchMock })).rejects.toBeInstanceOf(
      GroqMissingKeyError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws GroqTimeoutError when Groq does not answer before the deadline", async () => {
    const fetchMock = hangingFetch();
    const call = groqChat(REQUEST, { env: ENV, fetch: fetchMock });
    const assertion = expect(call).rejects.toBeInstanceOf(GroqTimeoutError);
    await vi.advanceTimersByTimeAsync(GROQ_DEADLINE_MS);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the deadline inside the client's 8 s live timeout", () => {
    expect(GROQ_DEADLINE_MS).toBeLessThan(8000);
  });

  it("retries once after a 429 and returns the second answer", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(tooMany("1")).mockResolvedValueOnce(ok("second"));
    const call = groqChat(REQUEST, { env: ENV, fetch: fetchMock });
    await vi.advanceTimersByTimeAsync(1000);
    await expect(call).resolves.toMatchObject({ content: "second" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("waits for retry-after before retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(tooMany("2")).mockResolvedValueOnce(ok());
    const call = groqChat(REQUEST, { env: ENV, fetch: fetchMock });

    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await expect(call).resolves.toMatchObject({ content: '{"text":"hello"}' });
  });

  it("throws GroqRateLimitError after a second 429 and makes no third call", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(tooMany("1")).mockResolvedValueOnce(tooMany("1"));
    const call = groqChat(REQUEST, { env: ENV, fetch: fetchMock });
    const assertion = expect(call).rejects.toMatchObject({ code: "rate_limited", retried: true });
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    await expect(call).rejects.toBeInstanceOf(GroqRateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry early when retry-after is longer than the time left", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(tooMany("30")).mockResolvedValueOnce(ok());
    await expect(groqChat(REQUEST, { env: ENV, fetch: fetchMock })).rejects.toMatchObject({
      code: "rate_limited",
      retried: false,
      retryAfterMs: 30_000,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("times out during a retry wait that the deadline cuts short", async () => {
    // 5 s wait + 1.5 s minimum attempt fits in 7 s, but the retry itself hangs.
    const hang = hangingFetch();
    const fetchMock = vi.fn().mockResolvedValueOnce(tooMany("5")).mockImplementationOnce(hang);
    const call = groqChat(REQUEST, { env: ENV, fetch: fetchMock });
    const assertion = expect(call).rejects.toBeInstanceOf(GroqTimeoutError);
    await vi.advanceTimersByTimeAsync(GROQ_DEADLINE_MS);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws GroqHttpError with the status for other non-2xx responses", async () => {
    const fetchMock = vi.fn(async () => new Response("bad gateway", { status: 502 }));
    const err = await groqChat(REQUEST, { env: ENV, fetch: fetchMock }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GroqHttpError);
    expect(err).toBeInstanceOf(GroqError);
    expect((err as GroqHttpError).status).toBe(502);
    expect((err as GroqHttpError).bodySnippet).toBe("bad gateway");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws GroqBadResponseError when the body has no message content", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }));
    await expect(groqChat(REQUEST, { env: ENV, fetch: fetchMock })).rejects.toBeInstanceOf(GroqBadResponseError);
  });

  it("wraps fetch network failures in a GroqError", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(groqChat(REQUEST, { env: ENV, fetch: fetchMock })).rejects.toMatchObject({ code: "network" });
  });

  it("never puts the key in an error message", async () => {
    const fetchMock = vi.fn(async () => new Response("nope", { status: 401 }));
    const err = (await groqChat(REQUEST, { env: ENV, fetch: fetchMock }).catch((e: unknown) => e)) as Error;
    expect(err.message).not.toContain("test-key");
  });
});

describe("parseRetryAfter", () => {
  it("reads seconds, HTTP dates and rejects junk", () => {
    expect(parseRetryAfter("2")).toBe(2000);
    expect(parseRetryAfter("0.5")).toBe(500);
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter("soon")).toBeUndefined();
    expect(parseRetryAfter("-1")).toBeUndefined();
    const now = Date.parse("2026-11-15T12:00:00Z");
    expect(parseRetryAfter("Sun, 15 Nov 2026 12:00:03 GMT", now)).toBe(3000);
  });
});
