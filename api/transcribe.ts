/**
 * POST /api/transcribe: voice dictation (issue 30, step 8).
 *
 * Body: multipart/form-data with one `file` field holding a short audio clip
 * (webm/opus from MediaRecorder, ≤ MAX_AUDIO_BYTES).
 * 200 → {text} for the client to put in the input box for review; it is never auto-sent.
 * Any failure → non-2xx `{error, fallback: true}`, the same contract as /api/assistant.
 * Audio is forwarded to Groq and not stored or logged here.
 */
import { GroqError, type GroqCallOptions } from "./_lib/groq.ts";
import { fail, json } from "./_lib/http.ts";
import { groqTranscribe } from "./_lib/transcribe.ts";

/** 60 s of opus at the client's 32 kbps is ~240 KB; 2 MB leaves room for browsers that ignore the bitrate. */
export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
/** Multipart overhead allowed on top of the audio. */
const MAX_BODY_BYTES = MAX_AUDIO_BYTES + 16 * 1024;

export const ALLOWED_AUDIO_TYPES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"] as const;

const EXTENSION: Record<(typeof ALLOWED_AUDIO_TYPES)[number], string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

/** "audio/webm;codecs=opus" → "audio/webm" if allowed. */
function baseAudioType(type: string): (typeof ALLOWED_AUDIO_TYPES)[number] | undefined {
  const base = type.split(";")[0]?.trim().toLowerCase() ?? "";
  return (ALLOWED_AUDIO_TYPES as readonly string[]).includes(base) ? (base as (typeof ALLOWED_AUDIO_TYPES)[number]) : undefined;
}

export interface TranscribeDeps {
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  deadlineMs?: number;
}

export async function handleTranscribe(request: Request, deps: TranscribeDeps = {}): Promise<Response> {
  if (request.method !== "POST") return fail("method_not_allowed");
  const env = deps.env ?? process.env;

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) return fail("unsupported_type");
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return fail("too_large");

  let form: FormData;
  try {
    // Read the bytes first so a missing or wrong content-length cannot get past the limit.
    const raw = await request.arrayBuffer();
    if (raw.byteLength > MAX_BODY_BYTES) return fail("too_large");
    form = await new Response(raw, { headers: { "content-type": contentType } }).formData();
  } catch {
    return fail("bad_request");
  }

  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) return fail("bad_request");
  if (file.size > MAX_AUDIO_BYTES) return fail("too_large");
  const audioType = baseAudioType(file.type);
  if (!audioType) return fail("unsupported_type");

  try {
    const options: GroqCallOptions = { env, fetch: deps.fetch, signal: request.signal };
    if (deps.deadlineMs !== undefined) options.deadlineMs = deps.deadlineMs;
    const text = await groqTranscribe({ data: file, filename: `dictation.${EXTENSION[audioType]}` }, options);
    return json({ text });
  } catch (err) {
    if (err instanceof GroqError) {
      console.warn(`[api/transcribe] groq ${err.code}: ${err.message}`);
      return fail(err.code);
    }
    console.error("[api/transcribe] unexpected error", err);
    return fail("internal");
  }
}

export default {
  fetch(request: Request): Promise<Response> {
    return handleTranscribe(request);
  },
};
