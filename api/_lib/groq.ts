/**
 * Minimal Groq chat-completions client for the serverless handlers (issue 30, step 3).
 *
 * Server-side only. It reads GROQ_API_KEY and GROQ_MODEL from the function
 * environment; never give these a VITE_ prefix, and never import this file
 * from src/, or the key would end up in the client bundle.
 *
 * Every failure throws a GroqError subclass, so a handler can catch
 * `instanceof GroqError` and return the offline fallback.
 */

export const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

/**
 * Total time for one call, including the single 429 retry and its wait.
 * The client aborts at LIVE_TIMEOUT_MS (8000 ms, src/modules/assistant/providers.ts)
 * and must show its offline note within 9 s. 7000 ms leaves about 1 s for
 * retrieval, the handler and the network trip back.
 */
export const GROQ_DEADLINE_MS = 7000;
/** Wait used when a 429 has no usable retry-after header. */
export const DEFAULT_RETRY_WAIT_MS = 1000;
/** A retry is only worth it if at least this much time is left after the wait. */
export const MIN_ATTEMPT_MS = 1500;

export type GroqErrorCode = "missing_key" | "timeout" | "rate_limited" | "http" | "network" | "bad_response";

export class GroqError extends Error {
  readonly code: GroqErrorCode;
  constructor(code: GroqErrorCode, message: string) {
    super(message);
    this.name = "GroqError";
    this.code = code;
  }
}

export class GroqMissingKeyError extends GroqError {
  constructor() {
    super("missing_key", "GROQ_API_KEY is not set");
    this.name = "GroqMissingKeyError";
  }
}

export class GroqTimeoutError extends GroqError {
  readonly timeoutMs: number;
  constructor(timeoutMs: number) {
    super("timeout", `Groq did not answer within ${timeoutMs} ms`);
    this.name = "GroqTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export class GroqRateLimitError extends GroqError {
  /** True when the one retry was made and also got 429; false when the retry-after wait did not fit the deadline. */
  readonly retried: boolean;
  readonly retryAfterMs?: number;
  constructor(retried: boolean, retryAfterMs?: number) {
    super("rate_limited", retried ? "Groq rate limit (429) after one retry" : "Groq rate limit (429); retry-after does not fit the deadline");
    this.name = "GroqRateLimitError";
    this.retried = retried;
    this.retryAfterMs = retryAfterMs;
  }
}

export class GroqHttpError extends GroqError {
  readonly status: number;
  /** First 300 characters of the error body, for logs. Never contains the key. */
  readonly bodySnippet: string;
  constructor(status: number, bodySnippet: string) {
    super("http", `Groq returned HTTP ${status}`);
    this.name = "GroqHttpError";
    this.status = status;
    this.bodySnippet = bodySnippet;
  }
}

export class GroqNetworkError extends GroqError {
  constructor(cause: unknown) {
    super("network", `Groq request failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "GroqNetworkError";
  }
}

export class GroqBadResponseError extends GroqError {
  constructor(detail: string) {
    super("bad_response", `Groq response was not usable: ${detail}`);
    this.name = "GroqBadResponseError";
  }
}

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqJsonSchemaFormat {
  type: "json_schema";
  json_schema: {
    name: string;
    schema: Record<string, unknown>;
    strict?: boolean;
    description?: string;
  };
}

export type GroqResponseFormat = GroqJsonSchemaFormat | { type: "json_object" } | { type: "text" };

/** The request body fields Pulseframe uses. `model` comes from GROQ_MODEL. */
export interface GroqChatRequest {
  messages: GroqMessage[];
  response_format?: GroqResponseFormat;
  reasoning_effort?: "low" | "medium" | "high";
  max_completion_tokens?: number;
  temperature?: number;
}

export interface GroqUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  [extra: string]: unknown;
}

export interface GroqChatResult {
  content: string;
  usage?: GroqUsage;
  model: string;
  finishReason?: string;
}

export interface GroqCallOptions {
  /** Defaults to process.env. */
  env?: Record<string, string | undefined>;
  /** Defaults to globalThis.fetch. */
  fetch?: typeof fetch;
  /** Defaults to GROQ_DEADLINE_MS. */
  deadlineMs?: number;
  /** Optional caller signal (e.g. the incoming request), linked to the deadline. */
  signal?: AbortSignal;
}

/** retry-after is seconds per Groq's docs; an HTTP date is accepted too. Returns ms, or undefined if unusable. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds >= 0 ? Math.ceil(seconds * 1000) : undefined;
  const date = Date.parse(value);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, date - now);
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function readSnippet(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return "";
  }
}

/**
 * POST one chat completion to Groq.
 *
 * - One deadline (default 7000 ms) covers the whole call, retry included.
 * - On HTTP 429 it retries exactly once, after the retry-after wait
 *   (DEFAULT_RETRY_WAIT_MS when the header is missing). If that wait plus
 *   MIN_ATTEMPT_MS does not fit in the time left, it does not retry early
 *   against Groq's instruction: it throws GroqRateLimitError at once so the
 *   client gets its offline fallback sooner.
 */
export async function groqChat(request: GroqChatRequest, options: GroqCallOptions = {}): Promise<GroqChatResult> {
  const env = options.env ?? process.env;
  const apiKey = env.GROQ_API_KEY?.trim();
  if (!apiKey) throw new GroqMissingKeyError();
  const model = env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
  const doFetch = options.fetch ?? globalThis.fetch;
  const deadlineMs = options.deadlineMs ?? GROQ_DEADLINE_MS;

  const ctrl = new AbortController();
  const deadlineAt = Date.now() + deadlineMs;
  const timer = setTimeout(() => ctrl.abort(new GroqTimeoutError(deadlineMs)), deadlineMs);
  const onCallerAbort = () => ctrl.abort(options.signal?.reason);
  if (options.signal?.aborted) onCallerAbort();
  else options.signal?.addEventListener("abort", onCallerAbort, { once: true });

  const body = JSON.stringify({ ...request, model });
  const send = () =>
    doFetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body,
      signal: ctrl.signal,
    });

  try {
    let res = await send();

    if (res.status === 429) {
      const waitMs = parseRetryAfter(res.headers.get("retry-after")) ?? DEFAULT_RETRY_WAIT_MS;
      await res.body?.cancel().catch(() => undefined);
      if (waitMs + MIN_ATTEMPT_MS > deadlineAt - Date.now()) throw new GroqRateLimitError(false, waitMs);
      await sleep(waitMs, ctrl.signal);
      res = await send();
      if (res.status === 429) {
        await res.body?.cancel().catch(() => undefined);
        throw new GroqRateLimitError(true, parseRetryAfter(res.headers.get("retry-after")));
      }
    }

    if (!res.ok) throw new GroqHttpError(res.status, await readSnippet(res));

    let data: unknown;
    try {
      data = await res.json();
    } catch (err) {
      if (ctrl.signal.aborted) throw err;
      throw new GroqBadResponseError("body is not JSON");
    }
    return parseCompletion(data, model);
  } catch (err) {
    if (err instanceof GroqError) throw err;
    if (ctrl.signal.aborted) {
      const reason: unknown = ctrl.signal.reason;
      throw reason instanceof GroqError ? reason : new GroqTimeoutError(deadlineMs);
    }
    throw new GroqNetworkError(err);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onCallerAbort);
  }
}

function parseCompletion(data: unknown, requestedModel: string): GroqChatResult {
  if (typeof data !== "object" || data === null) throw new GroqBadResponseError("body is not an object");
  const record = data as {
    model?: unknown;
    choices?: Array<{ message?: { content?: unknown }; finish_reason?: unknown }>;
    usage?: unknown;
  };
  const choice = Array.isArray(record.choices) ? record.choices[0] : undefined;
  const content = choice?.message?.content;
  if (typeof content !== "string") throw new GroqBadResponseError("no choices[0].message.content");
  return {
    content,
    usage: isUsage(record.usage) ? record.usage : undefined,
    model: typeof record.model === "string" ? record.model : requestedModel,
    finishReason: typeof choice?.finish_reason === "string" ? choice.finish_reason : undefined,
  };
}

function isUsage(value: unknown): value is GroqUsage {
  if (typeof value !== "object" || value === null) return false;
  const usage = value as Record<string, unknown>;
  return (
    typeof usage.prompt_tokens === "number" &&
    typeof usage.completion_tokens === "number" &&
    typeof usage.total_tokens === "number"
  );
}
