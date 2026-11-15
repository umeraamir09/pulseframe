import { useState, type FormEvent } from "react";
import { errorMessage } from "../caseActions";
import { StageCard } from "../StageCard";

const QUICK_PICKS = [
  { id: "chest", label: "Chest pain", text: "Chest tightness after resistive exercise session" },
  { id: "breathing", label: "Breathing", text: "Breathing feels harder than usual" },
  { id: "injury", label: "Injury", text: "Injury during a task" },
  { id: "fever", label: "Fever", text: "Feeling warmer than usual" },
  { id: "other", label: "Other", text: "" },
] as const;

const STARTED = [
  { id: "now", label: "Just now", suffix: " Started just now." },
  { id: "under-1h", label: "Under 1 h", suffix: "" },
  { id: "today", label: "Today", suffix: " Started today." },
] as const;

type StartedId = (typeof STARTED)[number]["id"];

function splitStarted(narrative: string): { text: string; started: StartedId } {
  for (const option of STARTED) {
    if (option.suffix && narrative.endsWith(option.suffix)) {
      return { text: narrative.slice(0, -option.suffix.length), started: option.id };
    }
  }
  return { text: narrative, started: "under-1h" };
}

export function IntakeStage({ initial = "", onStart }: { initial?: string; onStart: (narrative: string) => Promise<void> }) {
  const parsed = splitStarted(initial);
  const [text, setText] = useState(parsed.text);
  const [started, setStarted] = useState<StartedId>(parsed.started);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const ready = text.trim().length > 0 && !busy;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    const suffix = STARTED.find((option) => option.id === started)?.suffix ?? "";
    setBusy(true);
    setError(undefined);
    try {
      await onStart(`${text.trim()}${suffix}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <StageCard kicker="1 Situation" title="What is happening?">
      <form onSubmit={(event) => void submit(event)}>
        <div className="em-narrative">
          <label className="sr" htmlFor="em-narrative">
            Describe what is happening
          </label>
          <textarea
            id="em-narrative"
            value={text}
            placeholder="Chest tightness after resistive exercise session"
            maxLength={500}
            rows={3}
            onChange={(event) => setText(event.target.value)}
          />
          <p className="muted small">Typed by crew. {words === 1 ? "1 word" : `${words} words`}</p>
        </div>

        <p className="em-field-label">Quick pick</p>
        <div className="em-picks" role="group" aria-label="Quick pick">
          {QUICK_PICKS.map((pick) => {
            const on = pick.text.length > 0 && text === pick.text;
            return (
              <button
                key={pick.id}
                type="button"
                className={on ? "is-on" : undefined}
                aria-pressed={on}
                onClick={() => setText(pick.text)}
              >
                {pick.label}
              </button>
            );
          })}
        </div>

        <p className="em-field-label">Started</p>
        <div className="em-picks" role="group" aria-label="When it started">
          {STARTED.map((option) => (
            <button
              key={option.id}
              type="button"
              className={started === option.id ? "is-on" : undefined}
              aria-pressed={started === option.id}
              onClick={() => setStarted(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {error ? <p className="error">{error}</p> : null}
        <button type="submit" className="primary em-next" disabled={!ready}>
          {busy ? "Starting…" : "Next: pinpoint"}
        </button>
      </form>
    </StageCard>
  );
}
