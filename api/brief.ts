/**
 * POST /api/brief: the dashboard AI brief (issue 30, step 7).
 *
 * Body: a BriefSummary (src/modules/dashboard/briefSummary.ts), numbers only.
 * 200 → {notes: [{key, status, headline, action?, why?, arrow?, citations[]}]}
 * One note per notable measurement key. notes [] means nothing stood out.
 * (plus `usage` outside production).
 * Any failure → non-2xx `{error, fallback: true}`, the same contract as
 * /api/assistant. The client hides the brief; the dashboard is unaffected.
 */
import { BriefSummarySchema } from "../src/modules/dashboard/briefSummary.ts";
import {
  BRIEF_MAX_COMPLETION_TOKENS,
  BRIEF_RESPONSE_FORMAT,
  BriefOutputError,
  buildBriefPrompt,
  finalizeBrief,
  retrieveForBrief,
} from "./_lib/briefPrompt.ts";
import { GroqError, groqChat, type GroqCallOptions } from "./_lib/groq.ts";
import { fail, isDevelopment, json } from "./_lib/http.ts";

export interface BriefDeps {
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  deadlineMs?: number;
}

export async function handleBrief(request: Request, deps: BriefDeps = {}): Promise<Response> {
  if (request.method !== "POST") return fail("method_not_allowed");
  const env = deps.env ?? process.env;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("bad_request");
  }
  const parsed = BriefSummarySchema.safeParse(body);
  if (!parsed.success) return fail("bad_request");
  const summary = parsed.data;

  try {
    const retrieved = retrieveForBrief(summary);
    // Nothing to cite → no bullet could survive; skip the model call.
    if (!retrieved.chunks.length) return fail("bad_model_output");
    const prompt = buildBriefPrompt(summary, retrieved);
    const options: GroqCallOptions = { env, fetch: deps.fetch, signal: request.signal };
    if (deps.deadlineMs !== undefined) options.deadlineMs = deps.deadlineMs;
    const result = await groqChat(
      {
        messages: prompt.messages,
        response_format: BRIEF_RESPONSE_FORMAT,
        reasoning_effort: "low",
        max_completion_tokens: BRIEF_MAX_COMPLETION_TOKENS,
        temperature: 0.2,
      },
      options,
    );
    const brief: ReturnType<typeof finalizeBrief> & { usage?: unknown } = finalizeBrief(result.content, retrieved.ids, summary);
    if (isDevelopment(env)) {
      brief.usage = {
        ...result.usage,
        estimatedInputTokens: prompt.estimatedTokens,
        contextTokens: retrieved.usedTokens,
        model: result.model,
      };
    }
    return json(brief);
  } catch (err) {
    if (err instanceof GroqError) {
      console.warn(`[api/brief] groq ${err.code}: ${err.message}`);
      return fail(err.code);
    }
    if (err instanceof BriefOutputError) {
      console.warn(`[api/brief] ${err.message}`);
      return fail("bad_model_output");
    }
    console.error("[api/brief] unexpected error", err);
    return fail("internal");
  }
}

export default {
  fetch(request: Request): Promise<Response> {
    return handleBrief(request);
  },
};
