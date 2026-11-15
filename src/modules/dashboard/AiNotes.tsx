import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { MeasurementKey } from "../../contracts";
import { useLive } from "../../data/db";
import { Chip } from "../../ui/Chip";
import { Icon } from "../../ui/Icon";
import { getBrief, loadBriefSummary } from "./briefClient";
import { ACTION_MAX_WORDS, HEADLINE_MAX_WORDS, WHY_MAX_WORDS, crewPlain, type BriefNote } from "./briefCopy";
import type { BriefSummary } from "./briefSummary";
import { AiNotesContext, useAiNotes, type AiNotesPhase, type AiNotesValue } from "./useAiNotes";

function aiNotesButtonLabel(phase: AiNotesPhase, refreshing: boolean): string {
  if (refreshing) return "Refreshing…";
  if (phase === "loading") return "Loading…";
  if (phase === "offline") return "Offline";
  return "Refresh AI";
}

/** One small note: icon, status chip, short headline, optional arrow, action, and Why. */
export function AiNoteRow({ note }: { note: BriefNote }) {
  const headline = crewPlain(note.headline, HEADLINE_MAX_WORDS);
  const action = note.action ? crewPlain(note.action, ACTION_MAX_WORDS) : "";
  const why = note.why ? crewPlain(note.why, WHY_MAX_WORDS) : "";
  if (!headline) return null;
  const arrowLabel = note.arrow === "up" ? "Above your normal" : note.arrow === "down" ? "Below your normal" : "";
  return (
    <div className={`ai-note ${note.status}`} data-metric={note.key}>
      <div className="ai-note-main">
        <span className="ai-note-icon">
          <Icon name="sparkles" size={14} />
        </span>
        <span className="sr">AI note</span>
        <Chip tone={note.status} size="sm" />
        <span className="ai-note-headline">{headline}</span>
        {note.arrow && arrowLabel ? (
          <span className={`ai-note-arrow ${note.arrow}`} role="img" aria-label={arrowLabel}>
            {note.arrow === "up" ? "↑" : "↓"}
          </span>
        ) : null}
      </div>
      {action ? <p className="ai-note-action">{action}</p> : null}
      {why ? (
        <details className="ai-note-why">
          <summary>Why?</summary>
          <p>{why}</p>
        </details>
      ) : null}
    </div>
  );
}

/** Nothing notable means no extra row. */
export function AiNoteList({ notes }: { notes: readonly BriefNote[] }) {
  if (!notes.length) return null;
  return (
    <div className="ai-notes">
      {notes.map((note) => (
        <AiNoteRow key={note.key} note={note} />
      ))}
    </div>
  );
}

export function AiNotesRefreshButton({
  phase,
  refreshing,
  onClick,
}: {
  phase: AiNotesPhase;
  refreshing: boolean;
  onClick: () => void;
}) {
  const label = aiNotesButtonLabel(phase, refreshing);
  const disabled = refreshing || phase !== "ready";
  const aria =
    phase === "offline" ? "AI notes offline" : refreshing || phase === "loading" ? "AI notes loading" : "Refresh AI notes";
  return (
    <button type="button" className="btn ghost sm" onClick={onClick} disabled={disabled} aria-label={aria}>
      <Icon name="sparkles" size={16} />
      {label}
    </button>
  );
}

/** The one dashboard control for AI notes. Hidden when the assistant is not live. */
export function AiNotesRefresh() {
  const ai = useAiNotes();
  if (!ai.enabled) return null;
  return <AiNotesRefreshButton phase={ai.phase} refreshing={ai.refreshing} onClick={ai.refresh} />;
}

function LiveAiNotes({ children }: { children: ReactNode }) {
  const { data: summary, error } = useLive(loadBriefSummary, []);
  const [notes, setNotes] = useState<BriefNote[]>();
  const [phase, setPhase] = useState<AiNotesPhase>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const summaryJson = summary ? JSON.stringify(summary) : undefined;
  const summaryRef = useRef(summaryJson);
  const notesRef = useRef(notes);
  const refreshingRef = useRef(false);
  const request = useRef(0);

  useEffect(() => {
    summaryRef.current = summaryJson;
    notesRef.current = notes;
  }, [summaryJson, notes]);

  const apply = useCallback((next: BriefNote[] | undefined) => {
    if (next) {
      notesRef.current = next;
      setNotes(next);
    }
    setPhase(typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "ready");
  }, []);

  const run = useCallback(
    (json: string, force: boolean) => {
      const id = ++request.current;
      return getBrief(JSON.parse(json) as BriefSummary, force).then((next) => {
        if (id === request.current) apply(next);
      });
    },
    [apply],
  );

  useEffect(() => {
    if (!summaryJson) return;
    void run(summaryJson, false);
  }, [summaryJson, run]);

  const refresh = useCallback(() => {
    const json = summaryRef.current;
    if (!json || refreshingRef.current) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setPhase("offline");
      return;
    }
    refreshingRef.current = true;
    setRefreshing(true);
    void run(json, true).finally(() => {
      refreshingRef.current = false;
      setRefreshing(false);
    });
  }, [run]);

  useEffect(() => {
    function onOnline() {
      setPhase((current) => (current === "offline" ? "ready" : current));
      if (!notesRef.current) refresh();
    }
    function onOffline() {
      setPhase("offline");
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refresh]);

  const byKey = useMemo(() => {
    const map: Partial<Record<MeasurementKey, BriefNote>> = {};
    for (const note of notes ?? []) map[note.key] = note;
    return map;
  }, [notes]);

  const shownPhase: AiNotesPhase = error && notes === undefined && phase === "loading" ? "ready" : phase;

  const value = useMemo<AiNotesValue>(
    () => ({ enabled: true, phase: shownPhase, refreshing, byKey, refresh }),
    [shownPhase, refreshing, byKey, refresh],
  );

  return <AiNotesContext.Provider value={value}>{children}</AiNotesContext.Provider>;
}

/** Loads notes only in live assistant mode. Otherwise the dashboard is unchanged. */
export function AiNotesProvider({ children }: { children: ReactNode }) {
  if (import.meta.env.VITE_ASSISTANT_MODE !== "live") return children;
  return <LiveAiNotes>{children}</LiveAiNotes>;
}
