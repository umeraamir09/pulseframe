import { describe, expect, it, vi } from "vitest";
import { canDictate, deliverClip, mergeTranscript, MAX_RECORDING_MS, transcribeClip, TRANSCRIBE_TIMEOUT_MS } from "./dictation";

const clip = new Blob([new Uint8Array(10)], { type: "audio/webm;codecs=opus" });
const ready = { mode: "live", online: true, hasMediaRecorder: true, hasGetUserMedia: true };

describe("canDictate", () => {
  it("shows only in live mode, online, with recording support", () => {
    expect(canDictate(ready)).toBe(true);
    expect(canDictate({ ...ready, mode: undefined })).toBe(false);
    expect(canDictate({ ...ready, mode: "offline" })).toBe(false);
    expect(canDictate({ ...ready, online: false })).toBe(false);
    expect(canDictate({ ...ready, hasMediaRecorder: false })).toBe(false);
    expect(canDictate({ ...ready, hasGetUserMedia: false })).toBe(false);
  });

  it("caps recording at 60 s and the client wait at 8 s", () => {
    expect(MAX_RECORDING_MS).toBe(60_000);
    expect(TRANSCRIBE_TIMEOUT_MS).toBeLessThanOrEqual(8000);
  });
});

describe("mergeTranscript", () => {
  it("fills an empty box and appends to typed text", () => {
    expect(mergeTranscript("", " chest tight ")).toBe("chest tight");
    expect(mergeTranscript("started at 3pm  ", "chest tight")).toBe("started at 3pm chest tight");
    expect(mergeTranscript("keep", "   ")).toBe("keep");
    expect(mergeTranscript("abc", "defgh", 6)).toBe("abc de");
  });
});

describe("transcript fills the box without sending", () => {
  it("puts the transcript in the box and only calls /api/transcribe", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ text: "find ibuprofen" }), { status: 200 }));
    let box = "";
    const send = vi.fn();
    const result = await deliverClip(clip, (text) => {
      box = mergeTranscript(box, text);
    }, (c) => transcribeClip(c, { fetch: fetchMock }));

    expect(result).toBe("filled");
    expect(box).toBe("find ibuprofen");
    expect(send).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("/api/transcribe");
  });

  it("leaves the box alone and reports failure on a fallback response", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "rate_limited", fallback: true }), { status: 503 }));
    const fill = vi.fn();
    expect(await deliverClip(clip, fill, (c) => transcribeClip(c, { fetch: fetchMock }))).toBe("failed");
    expect(fill).not.toHaveBeenCalled();
  });

  it("gives up after the client timeout", async () => {
    vi.useFakeTimers();
    try {
      const hang = vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")))),
      );
      const pending = transcribeClip(clip, { fetch: hang as unknown as typeof fetch });
      await vi.advanceTimersByTimeAsync(TRANSCRIBE_TIMEOUT_MS);
      expect(await pending).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
