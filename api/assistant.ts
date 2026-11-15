/**
 * POST /api/assistant: live chat grounded in the research pack (issue 30, step 5).
 *
 * Vercel Function, Web-standard form (`export default { fetch }`).
 *
 * 200 → {kind, text, citations[], blocks[], draft?, notFound} (plus `usage` outside production).
 * kind is "research" (cited), "general" (uncited, non-medical) or "notFound".
 * Any failure → a non-2xx JSON body `{error, fallback: true}` with no `text`.
 * liveProvider treats every non-2xx (and any body without text) as "use the
 * offline provider and show LIVE_FALLBACK_NOTE", so the crew never sees a blank screen.
 */
import {
  ANSWER_RESPONSE_FORMAT,
  ASSISTANT_MAX_COMPLETION_TOKENS,
  AssistantRequestSchema,
  CONTEXT_BUDGET_TOKENS,
  ModelOutputError,
  buildPrompt,
  finalizeAnswer,
  parseModelAnswer,
  pickCard,
  type AssistantAnswer,
} from "./_lib/assistantPrompt.ts";
import { GroqError, groqChat, type GroqCallOptions, type GroqUsage } from "./_lib/groq.ts";
import { retrieve } from "./_lib/retrieve.ts";

export type AssistantErrorCode = "method_not_allowed" | "bad_request" | "bad_model_output" | GroqError["code"] | "internal";

export interface AssistantDeps {
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  deadlineMs?: number;
}

export interface AssistantDevUsage extends Partial<GroqUsage> {
  /** chars ÷ 4 over system + user message, the figure the ≤ 3,000 budget is checked on. */
  estimatedInputTokens: number;
  contextTokens: number;
  model?: string;
}

/** Preview and `vercel dev` count as development; outside Vercel, NODE_ENV decides. */
export function isDevelopment(env: Record<string, string | undefined>): boolean {
  if (env.VERCEL_ENV) return env.VERCEL_ENV !== "production";
  return env.NODE_ENV !== "production";
}

const STATUS: Record<AssistantErrorCode, number> = {
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

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });
}

function fail(code: AssistantErrorCode): Response {
  return json({ error: code, fallback: true }, STATUS[code], code === "method_not_allowed" ? { Allow: "POST" } : {});
}

export async function handleAssistant(request: Request, deps: AssistantDeps = {}): Promise<Response> {
  if (request.method !== "POST") return fail("method_not_allowed");
  const env = deps.env ?? process.env;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("bad_request");
  }
  const parsed = AssistantRequestSchema.safeParse(body);
  if (!parsed.success) return fail("bad_request");
  const input = parsed.data;

  try {
    const card = pickCard(input);
    const retrieved = retrieve({
      question: input.command,
      protocolId: card?.id,
      regionIds: input.caseCtx?.regionIds,
      budgetTokens: CONTEXT_BUDGET_TOKENS,
    });
    const dev = isDevelopment(env);

    // Even with no retrieved chunks the model is called: the question may be
    // general ("hello", "what is microgravity?"). With an empty CONTEXT it can
    // only answer kind "general" or "notFound"; finalizeAnswer turns an
    // uncited research answer into notFound.
    const prompt = buildPrompt(input, retrieved, card);
    const options: GroqCallOptions = { env, fetch: deps.fetch, signal: request.signal };
    if (deps.deadlineMs !== undefined) options.deadlineMs = deps.deadlineMs;
    const result = await groqChat(
      {
        messages: prompt.messages,
        response_format: ANSWER_RESPONSE_FORMAT,
        reasoning_effort: "low",
        max_completion_tokens: ASSISTANT_MAX_COMPLETION_TOKENS,
        temperature: 0.2,
      },
      options,
    );

    const answer: AssistantAnswer & { usage?: AssistantDevUsage } = finalizeAnswer(
      parseModelAnswer(result.content),
      retrieved.ids,
    );
    if (dev) {
      answer.usage = {
        ...result.usage,
        estimatedInputTokens: prompt.estimatedTokens,
        contextTokens: retrieved.usedTokens,
        model: result.model,
      };
    }
    return json(answer);
  } catch (err) {
    if (err instanceof GroqError) {
      console.warn(`[api/assistant] groq ${err.code}: ${err.message}`);
      return fail(err.code);
    }
    if (err instanceof ModelOutputError) {
      console.warn(`[api/assistant] ${err.message}`);
      return fail("bad_model_output");
    }
    console.error("[api/assistant] unexpected error", err);
    return fail("internal");
  }
}

export default {
  fetch(request: Request): Promise<Response> {
    return handleAssistant(request);
  },
};
