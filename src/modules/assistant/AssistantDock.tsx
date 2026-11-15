import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { SIM_CREW, store } from "../../data/db";
import { ActionCard } from "./ActionCard";
import { numberMarkers } from "./citations";
import { getProvider, type AssistantReply } from "./providers";
import { spokenToCommand } from "./spoken";

/* The Web Speech API is not in TypeScript's DOM lib, so declare the bits we use. */
interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const BARS = 5;
const MAX_REPLY_LINES = 8;

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Floating assistant: a round button in the corner that opens into a bar.
 * The mic records speech (shown with a live level meter and timer), turns it into a
 * command, and asks the same provider the Assistant page uses. Audio is never stored.
 */
export function AssistantDock() {
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [draft, setDraft] = useState("");
  const [heard, setHeard] = useState("");
  const [pending, setPending] = useState(false);
  const [reply, setReply] = useState<(AssistantReply & { command: string }) | undefined>();
  const [notice, setNotice] = useState<string>();

  const recRef = useRef<Recognition | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const barsRef = useRef<HTMLSpanElement[]>([]);
  const finalRef = useRef("");
  const heardRef = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);
  const speechSupported = typeof window !== "undefined" && recognitionCtor() !== undefined;

  const ask = useCallback(async (raw: string) => {
    const command = spokenToCommand(raw) || raw.trim();
    if (!command) return;
    setPending(true);
    setDraft("");
    try {
      const [inventory, current] = await Promise.all([store.listInventory(), store.getOpenCase(SIM_CREW.id)]);
      const res = await getProvider().ask({
        command,
        inventory,
        caseCtx: current
          ? {
              caseId: current.id,
              crewId: current.crewId,
              narrative: current.narrative,
              regionIds: current.regionIds,
              protocolId: current.protocolId,
            }
          : undefined,
      });
      // The dock has no source chips, so live answers lose their raw [chunk-id] markers here.
      setReply({ ...res, command, text: numberMarkers(res.text, {}) });
    } catch (err) {
      setReply({ command, text: err instanceof Error ? err.message : "The assistant could not answer. Try again." });
    } finally {
      setPending(false);
    }
  }, []);

  const releaseAudio = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioRef.current?.close().catch(() => undefined);
    audioRef.current = null;
    barsRef.current.forEach((b) => b && (b.style.transform = "scaleY(0.15)"));
  }, []);

  /** Ends the recording; with send, asks whatever was heard. */
  const finish = useCallback(
    (send: boolean) => {
      recRef.current = null;
      releaseAudio();
      setRecording(false);
      if (!send) return;
      const said = (finalRef.current || heardRef.current).trim();
      if (said) void ask(said);
      else setNotice((n) => n ?? "Didn't catch that. Try again or type.");
    },
    [ask, releaseAudio],
  );

  /** Stop listening and send. The recognizer delivers its last result before onend, which calls finish. */
  const stop = useCallback(
    (send: boolean) => {
      const rec = recRef.current;
      if (rec && send) {
        rec.stop();
        return;
      }
      if (rec) {
        rec.onend = null;
        rec.abort();
      }
      finish(send && rec !== null);
    },
    [finish],
  );

  async function start() {
    setNotice(undefined);
    setReply(undefined);
    setHeard("");
    finalRef.current = "";
    heardRef.current = "";
    if (!navigator.mediaDevices?.getUserMedia) {
      setNotice("This browser can't use the microphone. Type your question instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const step = Math.floor(data.length / (BARS + 2));
        barsRef.current.forEach((bar, i) => {
          if (!bar) return;
          const level = data[(i + 1) * step] / 255;
          bar.style.transform = `scaleY(${Math.max(0.15, level).toFixed(2)})`;
        });
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      releaseAudio();
      setNotice("Microphone blocked. Allow it in the browser, or type instead.");
      return;
    }

    const Ctor = recognitionCtor();
    if (Ctor) {
      const rec = new Ctor();
      rec.lang = "en-US";
      rec.continuous = false;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalRef.current += r[0].transcript;
          else interim += r[0].transcript;
        }
        heardRef.current = (finalRef.current + interim).trim();
        setHeard(heardRef.current);
      };
      rec.onerror = (e) => {
        if (e.error === "not-allowed") setNotice("Microphone blocked. Allow it in the browser, or type instead.");
        else if (e.error === "network") setNotice("Speech-to-text needs a connection here. Type instead.");
      };
      rec.onend = () => finish(true);
      recRef.current = rec;
      rec.start();
    } else {
      setNotice("Speech-to-text isn't supported in this browser. The meter shows the mic works; type to ask.");
    }
    setSeconds(0);
    setRecording(true);
  }

  // Timer while recording.
  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [recording]);

  // Clean up on unmount.
  useEffect(() => () => stop(false), [stop]);

  // Escape closes the bar.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") collapse();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function collapse() {
    if (recording) stop(false);
    setOpen(false);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (draft.trim()) void ask(draft);
  }

  const replyLines = reply?.text.split("\n").filter((l) => l.trim() !== "") ?? [];
  const card = reply?.kind === "emergency" || reply?.kind === "app";
  const clipped = !card && replyLines.length > MAX_REPLY_LINES;

  return (
    <div className={`ai-dock${open ? " is-open" : ""}${recording ? " is-recording" : ""}`}>
      {open && (reply || notice || pending) ? (
        <div className="ai-dock-reply" role="status" aria-live="polite">
          {pending ? <p className="ai-dock-muted">Thinking…</p> : null}
          {notice && !pending ? <p className="ai-dock-notice">{notice}</p> : null}
          {reply && !pending ? (
            <>
              <p className="ai-dock-cmd">{reply.command}</p>
              {card ? (
                <ActionCard reply={reply} />
              ) : (
                replyLines.slice(0, MAX_REPLY_LINES).map((line, i) => <p key={i}>{line}</p>)
              )}
              <p className="ai-dock-foot">
                {clipped ? "More in the full answer. " : ""}
                <Link to="/assistant" onClick={() => setOpen(false)}>
                  Open Assistant
                </Link>
                <span> · Decision support only</span>
              </p>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="ai-dock-shell">
        {!open ? (
          <button
            type="button"
            className="ai-dock-fab"
            aria-label="Open assistant"
            title="Ask the assistant"
            onClick={() => {
              setOpen(true);
              window.setTimeout(() => inputRef.current?.focus(), 250);
            }}
          >
            <MicIcon />
          </button>
        ) : (
          <>
            <button
              type="button"
              className="ai-dock-mic"
              aria-pressed={recording}
              aria-label={recording ? "Stop recording" : "Start recording"}
              onClick={() => (recording ? stop(true) : void start())}
              disabled={pending}
            >
              {recording ? <StopIcon /> : <MicIcon />}
            </button>

            {recording ? (
              <div className="ai-dock-rec" aria-live="polite">
                <span className="ai-dock-dot" aria-hidden="true" />
                <span className="ai-dock-rec-label">Recording</span>
                <span className="ai-dock-time">{clock(seconds)}</span>
                <span className="ai-dock-meter" aria-hidden="true">
                  {Array.from({ length: BARS }, (_, i) => (
                    <span
                      key={i}
                      ref={(el) => {
                        if (el) barsRef.current[i] = el;
                      }}
                    />
                  ))}
                </span>
                <span className="ai-dock-heard">{heard || "Listening…"}</span>
              </div>
            ) : (
              <form className="ai-dock-form" onSubmit={submit}>
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={speechSupported ? "Tap the mic or type: find, alerts, suggest…" : "Type: find, alerts, suggest…"}
                  aria-label="Ask the assistant"
                  disabled={pending}
                />
                <button type="submit" className="ai-dock-send" aria-label="Send" disabled={pending || !draft.trim()}>
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="currentColor" d="M4 12h12.2l-4.6-4.6L13 6l7 6-7 6-1.4-1.4 4.6-4.6H4z" />
                  </svg>
                </button>
              </form>
            )}

            <button type="button" className="ai-dock-close" aria-label="Close assistant" onClick={collapse}>
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" />
    </svg>
  );
}
