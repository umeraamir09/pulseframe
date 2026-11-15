/**
 * Client helpers for voice dictation (issue 30, step 8). Kept free of React
 * so the rules can be unit tested: when the button shows, how a clip is
 * sent, and how the transcript lands in the box (filled, never sent).
 */

/** Longest recording; the recorder stops itself here. */
export const MAX_RECORDING_MS = 60_000;
/** Client gives up this long after recording stops (spec: ≤ 8 s). */
export const TRANSCRIBE_TIMEOUT_MS = 8000;
/** Keeps 60 s of opus around 240 KB, well under the server's 2 MB limit. */
export const RECORDER_BITS_PER_SECOND = 32_000;
export const PREFERRED_MIME = "audio/webm;codecs=opus";

export const DICTATION_FAILED_NOTE = "Dictation didn't work this time. Type instead, or try again.";
export const DICTATION_DENIED_NOTE = "Microphone access was blocked. You can still type.";

export interface DictationEnv {
  mode?: string;
  online?: boolean;
  hasMediaRecorder: boolean;
  hasGetUserMedia: boolean;
}

/** Live mode only, online only, and only where the browser can record. */
export function canDictate(env: DictationEnv): boolean {
  return env.mode === "live" && env.online !== false && env.hasMediaRecorder && env.hasGetUserMedia;
}

export function browserDictationEnv(): DictationEnv {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  return {
    mode: import.meta.env.VITE_ASSISTANT_MODE,
    online: nav?.onLine,
    hasMediaRecorder: typeof MediaRecorder !== "undefined",
    hasGetUserMedia: typeof nav?.mediaDevices?.getUserMedia === "function",
  };
}

/** Appends the transcript to what is already typed, with one space between. */
export function mergeTranscript(existing: string, transcript: string, maxLength?: number): string {
  const text = transcript.trim();
  if (!text) return existing;
  const merged = existing.trim() ? `${existing.replace(/\s+$/, "")} ${text}` : text;
  return maxLength === undefined ? merged : merged.slice(0, maxLength);
}

/** POST one clip to /api/transcribe. Resolves to the transcript, or undefined on any failure. */
export async function transcribeClip(
  clip: Blob,
  options: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<string | undefined> {
  const doFetch = options.fetch ?? globalThis.fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), options.timeoutMs ?? TRANSCRIBE_TIMEOUT_MS);
  try {
    const form = new FormData();
    const ext = clip.type.includes("ogg") ? "ogg" : clip.type.includes("mp4") ? "m4a" : "webm";
    form.append("file", clip, `dictation.${ext}`);
    const res = await doFetch("/api/transcribe", { method: "POST", body: form, signal: ctrl.signal });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { text?: unknown };
    return typeof data.text === "string" && data.text.trim() ? data.text.trim() : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sends a finished clip and hands the transcript to `fill` (which sets the
 * input box). It has no way to submit: the crew member reviews and sends.
 */
export async function deliverClip(
  clip: Blob,
  fill: (transcript: string) => void,
  transcribe: (clip: Blob) => Promise<string | undefined> = transcribeClip,
): Promise<"filled" | "failed"> {
  const text = await transcribe(clip);
  if (!text) return "failed";
  fill(text);
  return "filled";
}
