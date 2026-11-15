/**
 * Shared JSON response helpers for the live handlers (added for /api/brief).
 * Same status map and `{error, fallback: true}` contract as api/assistant.ts,
 * which keeps its own copy unchanged.
 */
import type { GroqErrorCode } from "./groq.ts";

export type HandlerErrorCode = "method_not_allowed" | "bad_request" | "bad_model_output" | GroqErrorCode | "internal";

export const ERROR_STATUS: Record<HandlerErrorCode, number> = {
  method_not_allowed: 405,
  bad_request: 400,
  bad_model_output: 502,
  missing_key: 503,
  timeout: 504,
  rate_limited: 503,
  http: 502,
  network: 502,
  bad_response: 502,
  internal: 500,
};

/** Preview and `vercel dev` count as development; outside Vercel, NODE_ENV decides. */
export function isDevelopment(env: Record<string, string | undefined>): boolean {
  if (env.VERCEL_ENV) return env.VERCEL_ENV !== "production";
  return env.NODE_ENV !== "production";
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });
}

export function fail(code: HandlerErrorCode): Response {
  return json({ error: code, fallback: true }, ERROR_STATUS[code], code === "method_not_allowed" ? { Allow: "POST" } : {});
}
