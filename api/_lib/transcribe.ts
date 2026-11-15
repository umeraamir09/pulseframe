/**
 * Groq Whisper transcription client for /api/transcribe (issue 30, step 8).
 *
 * Server-side only, like groq.ts: it reads GROQ_API_KEY and GROQ_STT_MODEL
 * from the function environment and must never be imported from src/.
 * It reuses groq.ts's error classes and retry-after parsing so the handler
 * maps failures with the same codes; groqChat itself is unchanged.
 */
import {
  DEFAULT_RETRY_WAIT_MS,
  GROQ_DEADLINE_MS,
  GroqBadResponseError,
  GroqError,
  GroqHttpError,
  GroqMissingKeyError,
  GroqNetworkError,
  GroqRateLimitError,
  GroqTimeoutError,
  MIN_ATTEMPT_MS,
  parseRetryAfter,
  type GroqCallOptions,
} from "./groq.ts";

export const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
export const DEFAULT_GROQ_STT_MODEL = "whisper-large-v3-turbo";

/** Whisper only reads the last 224 tokens of `prompt`. */
export const VOCAB_PROMPT_MAX_TOKENS = 224;

/**
 * Domain words Whisper tends to mishear: protocol keywords and onboard kit names.
 * Ordered by importance; buildVocabularyPrompt drops from the end to fit the cap.
 */
export const DOMAIN_VOCABULARY: readonly string[] = [
  "Pulseframe",
  "CO2",
  "cabin CO2",
  "carbon monoxide",
  "space motion sickness",
  "resistive exercise",
  "chest tightness",
  "laceration",
  "abrasion",
  "floating blood",
  "foreign body",
  "airway",
  "choking",
  "blue lips",
  "scald",
  "blister",
  "soot",
  "nausea",
  "vomiting",
  "disoriented",
  "migraine",
  "blurred vision",
  "systolic",
  "diastolic",
  "heart rate",
  "SpO2",
  "Convenience Medication Pack",
  "Emergency Medical Treatment Pack",
  "Oral Medication Pack",
  "Topical and Injectable Medication Pack",
  "aspirin",
  "acetaminophen",
  "ibuprofen",
  "ondansetron",
  "promethazine",
  "meclizine",
  "scopolamine",
  "diphenhydramine",
  "loratadine",
  "fexofenadine",
  "pseudoephedrine",
  "oxymetazoline",
  "olopatadine",
  "hypromellose",
  "loperamide",
  "bisacodyl",
  "zolpidem",
  "melatonin",
  "hydrocortisone",
  "mometasone",
  "bacitracin",
  "epinephrine",
  "atropine",
  "lidocaine",
  "nitroglycerin",
  "albuterol",
  "amoxicillin",
  "EpiPen",
  "ALS Medication Kit",
  "EVA",
  "ISS",
];

/**
 * Conservative token estimate for Whisper's tokenizer. Medical terms split
 * into more tokens than plain English, so this counts ~3 characters per
 * token instead of the 4 used for chat budgets in retrieve.ts.
 */
export function estimateWhisperTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

/** Comma-separated vocabulary, cut at a whole term so it fits maxTokens. */
export function buildVocabularyPrompt(
  terms: readonly string[] = DOMAIN_VOCABULARY,
  maxTokens = VOCAB_PROMPT_MAX_TOKENS,
): string {
  let prompt = "";
  for (const term of terms) {
    const next = prompt ? `${prompt}, ${term}` : term;
    if (estimateWhisperTokens(next) > maxTokens) break;
    prompt = next;
  }
  return prompt;
}

export interface TranscribeAudio {
  data: Blob;
  filename: string;
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

/**
 * POST one audio clip to Groq Whisper and return the plain-text transcript.
 * Same deadline and single-429-retry rules as groqChat.
 */
export async function groqTranscribe(audio: TranscribeAudio, options: GroqCallOptions = {}): Promise<string> {
  const env = options.env ?? process.env;
  const apiKey = env.GROQ_API_KEY?.trim();
  if (!apiKey) throw new GroqMissingKeyError();
  const model = env.GROQ_STT_MODEL?.trim() || DEFAULT_GROQ_STT_MODEL;
  const doFetch = options.fetch ?? globalThis.fetch;
  const deadlineMs = options.deadlineMs ?? GROQ_DEADLINE_MS;

  const ctrl = new AbortController();
  const deadlineAt = Date.now() + deadlineMs;
  const timer = setTimeout(() => ctrl.abort(new GroqTimeoutError(deadlineMs)), deadlineMs);
  const onCallerAbort = () => ctrl.abort(options.signal?.reason);
  if (options.signal?.aborted) onCallerAbort();
  else options.signal?.addEventListener("abort", onCallerAbort, { once: true });

  const prompt = buildVocabularyPrompt();
  const send = () => {
    // A FormData body can only be sent once, so build it per attempt.
    const form = new FormData();
    form.append("file", audio.data, audio.filename);
    form.append("model", model);
    form.append("language", "en");
    form.append("response_format", "text");
    form.append("temperature", "0");
    if (prompt) form.append("prompt", prompt);
    return doFetch(GROQ_TRANSCRIBE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: ctrl.signal,
    });
  };

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
    if (!res.ok) {
      let snippet = "";
      try {
        snippet = (await res.text()).slice(0, 300);
      } catch {
        /* ignore */
      }
      throw new GroqHttpError(res.status, snippet);
    }
    let text: string;
    try {
      text = await res.text();
    } catch (err) {
      if (ctrl.signal.aborted) throw err;
      throw new GroqBadResponseError("body could not be read");
    }
    return text.trim();
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
