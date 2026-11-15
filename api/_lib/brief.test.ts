import { describe, expect, it, vi } from "vitest";
import handler, { handleBrief } from "../brief.ts";
import type { BriefSummary } from "../../src/modules/dashboard/briefSummary.ts";
import { BRIEF_MAX_COMPLETION_TOKENS, BRIEF_SYSTEM_PROMPT, retrieveForBrief } from "./briefPrompt.ts";
import { GROQ_CHAT_URL } from "./groq.ts";

const PROD = { GROQ_API_KEY: "test-key", VERCEL_ENV: "production" };
const DEV = { GROQ_API_KEY: "test-key", VERCEL_ENV: "development" };

const SUMMARY: BriefSummary = {
  days: 7,
  openAlerts: { watch: 1, act: 0, keys: ["heartRate"] },
  metrics: [
    { key: "heartRate", n: 7, mean: 64, last: 71, baseMean: 62, baseStd: 4, z: 2.25 },
    { key: "sleepHours", n: 7, mean: 6.2, last: 6, baseMean: 6.5, baseStd: 0.5, z: -1 },
  ],
  checklist: { done: 3, total: 9 },
  radiationWeekMgy: 0.9,
};

const ids = [...retrieveForBrief(SUMMARY).ids];

function post(body: unknown): Request {
  return new Request("http://localhost/api/brief", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function groqOk(content: unknown): Response {
  return new Response(
    JSON.stringify({
      model: "openai/gpt-oss-120b",
      choices: [{ message: { role: "assistant", content: JSON.stringify(content) }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1500, completion_tokens: 200, total_tokens: 1700 },
    }),
    { status: 200 },
  );
}

const goodBullets = () => ({
  bullets: [
    { text: `Heart rate is above your baseline [${ids[0]}].`, cite: [ids[0]] },
    { text: `Sleep is a little short [${ids[1]}].`, cite: [ids[1]] },
    { text: `An invented claim [cond:invented].`, cite: ["cond:invented"] },
    { text: `Radiation is as expected [${ids[2]}].`, cite: [ids[2], "cond:invented"] },
  ],
});

describe("POST /api/brief", () => {
  it("returns cited bullets, drops invented citations, and sends the brief settings", async () => {
    expect(ids.length).toBeGreaterThanOrEqual(3);
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(groqOk(goodBullets()));
    const res = await handleBrief(post(SUMMARY), { env: PROD, fetch: fetchMock });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { bullets: Array<{ text: string; citations: string[] }> };
    expect(body).not.toHaveProperty("usage");
    expect(body.bullets).toEqual([
      { text: `Heart rate is above your baseline [${ids[0]}].`, citations: [ids[0]] },
      { text: `Sleep is a little short [${ids[1]}].`, citations: [ids[1]] },
      { text: `Radiation is as expected [${ids[2]}].`, citations: [ids[2]] },
    ]);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(GROQ_CHAT_URL);
    const sent = JSON.parse(String(init?.body)) as Record<string, unknown> & { messages: Array<{ content: string }> };
    expect(sent.reasoning_effort).toBe("low");
    expect(sent.temperature).toBe(0.2);
    expect(sent.max_completion_tokens).toBe(BRIEF_MAX_COMPLETION_TOKENS);
    expect((sent.response_format as { type: string; json_schema: { strict: boolean } }).json_schema.strict).toBe(true);
    expect(sent.messages[0]!.content).toBe(BRIEF_SYSTEM_PROMPT);
  });

  it("returns usage in development", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(groqOk(goodBullets()));
    const body = (await (await handleBrief(post(SUMMARY), { env: DEV, fetch: fetchMock })).json()) as { usage: { estimatedInputTokens: number } };
    expect(body.usage.estimatedInputTokens).toBeLessThanOrEqual(3000);
  });

  it("rejects raw rows and unknown fields without calling Groq", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const res = await handleBrief(post({ ...SUMMARY, rows: [{ id: "m1", value: 70 }] }), { env: PROD, fetch: fetchMock });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad_request", fallback: true });
    expect((await handleBrief(post("{"), { env: PROD, fetch: fetchMock })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back when fewer than 3 cited bullets survive", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(groqOk({ bullets: [{ text: "Uncited.", cite: [] }] }));
    const res = await handleBrief(post(SUMMARY), { env: PROD, fetch: fetchMock });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "bad_model_output", fallback: true });
  });

  it("falls back on a missing key, a Groq error, and a wrong method", async () => {
    const missing = await handleBrief(post(SUMMARY), { env: {}, fetch: vi.fn<typeof fetch>() });
    expect(missing.status).toBe(503);
    expect(await missing.json()).toEqual({ error: "missing_key", fallback: true });

    const down = await handleBrief(post(SUMMARY), { env: PROD, fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response("oops", { status: 500 })) });
    expect(down.ok).toBe(false);
    expect(await down.json()).toMatchObject({ fallback: true });

    const get = await handler.fetch(new Request("http://localhost/api/brief"));
    expect(get.status).toBe(405);
    expect(get.headers.get("Allow")).toBe("POST");
  });
});
