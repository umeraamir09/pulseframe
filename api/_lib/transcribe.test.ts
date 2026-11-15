import { describe, expect, it, vi } from "vitest";
import handler, { handleTranscribe, MAX_AUDIO_BYTES } from "../transcribe.ts";
import {
  buildVocabularyPrompt,
  DEFAULT_GROQ_STT_MODEL,
  DOMAIN_VOCABULARY,
  estimateWhisperTokens,
  GROQ_TRANSCRIBE_URL,
  VOCAB_PROMPT_MAX_TOKENS,
} from "./transcribe.ts";

const ENV = { GROQ_API_KEY: "test-key" };

function upload(file: Blob | string | null, init: { method?: string } = {}): Request {
  const form = new FormData();
  if (file !== null) form.append("file", file as Blob, "clip.webm");
  return new Request("http://localhost/api/transcribe", { method: init.method ?? "POST", body: form });
}

const clip = (bytes = 1000, type = "audio/webm;codecs=opus") => new Blob([new Uint8Array(bytes)], { type });

function textOk(text: string): Response {
  return new Response(text, { status: 200, headers: { "content-type": "text/plain" } });
}

async function body(res: Response) {
  return (await res.json()) as Record<string, unknown>;
}

describe("handleTranscribe", () => {
  it("forwards the clip to Groq Whisper and returns the transcript", async () => {
    const fetchMock = vi.fn(async () => textOk(" Cabin CO2 is high and I have a headache.\n"));
    const res = await handleTranscribe(upload(clip()), { env: ENV, fetch: fetchMock });
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ text: "Cabin CO2 is high and I have a headache." });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(GROQ_TRANSCRIBE_URL);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    const sent = init.body as FormData;
    expect(sent.get("model")).toBe(DEFAULT_GROQ_STT_MODEL);
    expect(sent.get("language")).toBe("en");
    expect(sent.get("response_format")).toBe("text");
    expect(sent.get("prompt")).toBe(buildVocabularyPrompt());
    const file = sent.get("file") as File;
    expect(file.size).toBe(1000);
    expect(file.name).toBe("dictation.webm");
  });

  it("uses GROQ_STT_MODEL when set", async () => {
    const fetchMock = vi.fn(async () => textOk("ok"));
    await handleTranscribe(upload(clip()), { env: { ...ENV, GROQ_STT_MODEL: "whisper-large-v3" }, fetch: fetchMock });
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.body as FormData).get("model")).toBe("whisper-large-v3");
  });

  it("falls back with 503 when the key is missing, without calling Groq", async () => {
    const fetchMock = vi.fn();
    const res = await handleTranscribe(upload(clip()), { env: {}, fetch: fetchMock });
    expect(res.status).toBe(503);
    expect(await body(res)).toEqual({ error: "missing_key", fallback: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries once on 429 after retry-after, then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("slow down", { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(textOk("second try"));
    const res = await handleTranscribe(upload(clip()), { env: ENV, fetch: fetchMock });
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ text: "second try" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back after a second 429", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 429, headers: { "retry-after": "0" } }));
    const res = await handleTranscribe(upload(clip()), { env: ENV, fetch: fetchMock });
    expect(res.status).toBe(503);
    expect(await body(res)).toEqual({ error: "rate_limited", fallback: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a clip over the size limit with 413", async () => {
    const fetchMock = vi.fn();
    const res = await handleTranscribe(upload(clip(MAX_AUDIO_BYTES + 1)), { env: ENV, fetch: fetchMock });
    expect(res.status).toBe(413);
    expect(await body(res)).toEqual({ error: "too_large", fallback: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a large body by content-length before reading it", async () => {
    const req = new Request("http://localhost/api/transcribe", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=x", "content-length": String(10 * 1024 * 1024) },
      body: "--x--",
    });
    const res = await handleTranscribe(req, { env: ENV, fetch: vi.fn() });
    expect(res.status).toBe(413);
  });

  it("rejects a non-audio file with 415", async () => {
    const fetchMock = vi.fn();
    const res = await handleTranscribe(upload(clip(100, "image/png")), { env: ENV, fetch: fetchMock });
    expect(res.status).toBe(415);
    expect(await body(res)).toEqual({ error: "unsupported_type", fallback: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a non-multipart body with 415", async () => {
    const req = new Request("http://localhost/api/transcribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const res = await handleTranscribe(req, { env: ENV, fetch: vi.fn() });
    expect(res.status).toBe(415);
  });

  it("rejects a form with no file with 400", async () => {
    const res = await handleTranscribe(upload(null), { env: ENV, fetch: vi.fn() });
    expect(res.status).toBe(400);
    expect(await body(res)).toEqual({ error: "bad_request", fallback: true });
  });

  it("rejects GET with 405 and an Allow header", async () => {
    const res = await handler.fetch(new Request("http://localhost/api/transcribe"));
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST");
    expect(await body(res)).toEqual({ error: "method_not_allowed", fallback: true });
  });

  it("falls back with 502 on a Groq error status", async () => {
    const fetchMock = vi.fn(async () => new Response("bad", { status: 500 }));
    const res = await handleTranscribe(upload(clip()), { env: ENV, fetch: fetchMock });
    expect(res.status).toBe(502);
    expect(await body(res)).toEqual({ error: "http", fallback: true });
  });
});

describe("buildVocabularyPrompt", () => {
  it("keeps the default vocabulary within Whisper's 224-token prompt", () => {
    expect(VOCAB_PROMPT_MAX_TOKENS).toBe(224);
    const prompt = buildVocabularyPrompt();
    expect(prompt.length).toBeGreaterThan(0);
    expect(estimateWhisperTokens(prompt)).toBeLessThanOrEqual(224);
    expect(prompt).toContain("CO2");
    expect(prompt).toContain("Convenience Medication Pack");
  });

  it("cuts an oversized list at a whole term", () => {
    const terms = Array.from({ length: 500 }, (_, i) => `term${i}`);
    const prompt = buildVocabularyPrompt(terms);
    expect(estimateWhisperTokens(prompt)).toBeLessThanOrEqual(VOCAB_PROMPT_MAX_TOKENS);
    expect(prompt.split(", ").every((t) => terms.includes(t))).toBe(true);
    expect(prompt.split(", ").length).toBeLessThan(terms.length);
  });

  it("has no duplicate terms", () => {
    expect(new Set(DOMAIN_VOCABULARY).size).toBe(DOMAIN_VOCABULARY.length);
  });
});
