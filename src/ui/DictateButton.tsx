import { useEffect, useRef, useState } from "react";
import {
  browserDictationEnv,
  canDictate,
  deliverClip,
  DICTATION_DENIED_NOTE,
  DICTATION_FAILED_NOTE,
  MAX_RECORDING_MS,
  PREFERRED_MIME,
  RECORDER_BITS_PER_SECOND,
} from "./dictation";

type State = "idle" | "recording" | "working";

function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

/**
 * Mic button that records up to 60 s and puts the transcript into the box
 * for review through `onTranscript`. It never submits. Hidden outside live
 * mode, offline, or where MediaRecorder/getUserMedia is missing. Failures
 * show a small note beside it; the box keeps working.
 */
export function DictateButton({ onTranscript, disabled, className }: { onTranscript: (text: string) => void; disabled?: boolean; className?: string }) {
  const online = useOnline();
  const [state, setState] = useState<State>("idle");
  const [note, setNote] = useState<string>();
  const [elapsed, setElapsed] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const alive = useRef(true);
  const fill = useRef(onTranscript);
  useEffect(() => {
    fill.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    if (state !== "recording") return;
    const startedAt = Date.now();
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 250);
    return () => clearInterval(tick);
  }, [state]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimeout(stopTimer.current);
      const rec = recorder.current;
      if (rec && rec.state !== "inactive") rec.stop();
    };
  }, []);

  if (!canDictate({ ...browserDictationEnv(), online })) return null;

  async function start() {
    setNote(undefined);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setNote(DICTATION_DENIED_NOTE);
      return;
    }
    let rec: MediaRecorder;
    try {
      const mimeType = MediaRecorder.isTypeSupported?.(PREFERRED_MIME) ? PREFERRED_MIME : undefined;
      rec = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: RECORDER_BITS_PER_SECOND });
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      setNote(DICTATION_FAILED_NOTE);
      return;
    }
    const chunks: Blob[] = [];
    rec.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    rec.onstop = () => {
      clearTimeout(stopTimer.current);
      stream.getTracks().forEach((t) => t.stop());
      recorder.current = null;
      if (!alive.current) return;
      const clip = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      if (!clip.size) {
        setState("idle");
        setNote(DICTATION_FAILED_NOTE);
        return;
      }
      setState("working");
      void deliverClip(clip, (text) => fill.current(text)).then((result) => {
        if (!alive.current) return;
        setState("idle");
        if (result === "failed") setNote(DICTATION_FAILED_NOTE);
      });
    };
    recorder.current = rec;
    rec.start();
    setElapsed(0);
    setState("recording");
    stopTimer.current = setTimeout(() => {
      if (rec.state !== "inactive") rec.stop();
    }, MAX_RECORDING_MS);
  }

  function toggle() {
    if (state === "recording") recorder.current?.stop();
    else if (state === "idle") void start();
  }

  const label = state === "recording" ? "Stop dictation" : state === "working" ? "Transcribing" : "Dictate";
  const left = Math.max(0, MAX_RECORDING_MS / 1000 - elapsed);
  return (
    <span className={["dictate", `is-${state}`, className].filter(Boolean).join(" ")}>
      <button
        type="button"
        className={`dictate-btn${state === "recording" ? " is-recording" : ""}${state === "working" ? " is-working" : ""}`}
        aria-label={label}
        aria-pressed={state === "recording"}
        title={state === "recording" ? "Stop and transcribe (60 s max)" : "Dictate. The text goes into the box for you to review."}
        disabled={disabled || state === "working"}
        onClick={toggle}
      >
        {state === "working" ? (
          <span className="dictate-spinner" aria-hidden="true" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            {state === "recording" ? (
              <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
            ) : (
              <path
                fill="currentColor"
                d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z"
              />
            )}
          </svg>
        )}
      </button>
      {state === "recording" && (
        <span className="dictate-live" role="status" aria-label={`Recording, ${elapsed} seconds`}>
          <span className="dictate-dot" aria-hidden="true" />
          <span className="dictate-wave" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="dictate-time">
            {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
          </span>
          {left <= 10 && <span className="dictate-left">{left}s left</span>}
        </span>
      )}
      {state === "working" && (
        <span className="dictate-note dictate-working" role="status">
          Transcribing<span className="dictate-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>
        </span>
      )}
      {note && state === "idle" && (
        <span className="dictate-note" role="status">
          {note}
        </span>
      )}
    </span>
  );
}
