import { useState, type FormEvent } from "react";
import type { ProtocolStep } from "../../../contracts";
import { errorMessage } from "../caseActions";
import { MiniProgress, StageCard } from "../StageCard";

export function ImmediateStage({
  steps,
  onToggle,
  onSkip,
  onContinue,
}: {
  steps: ProtocolStep[];
  onToggle: (stepId: string) => Promise<void>;
  onSkip: (reason: string) => Promise<void>;
  onContinue: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [skipped, setSkipped] = useState(false);
  const [error, setError] = useState<string>();
  const done = steps.filter((step) => step.completed).length;
  const allDone = steps.length > 0 && done === steps.length;

  async function toggle(stepId: string) {
    setBusy(true);
    setError(undefined);
    try {
      await onToggle(stepId);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function skip(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim() || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await onSkip(reason);
      setSkipped(true);
      setSkipOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    setError(undefined);
    try {
      await onContinue();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <StageCard kicker="6 Steps" title="Do these now" meta={<MiniProgress done={done} total={steps.length} />}>
      <ol className="em-action-list">
        {steps.map((step, index) => (
          <li key={step.id} className={step.completed ? "em-action is-done" : "em-action"}>
            <span className="em-num" aria-hidden="true">
              {step.completed ? "✓" : index + 1}
            </span>
            <div className="em-action-copy">
              <h3>{step.title}</h3>
              <p>{step.instruction}</p>
            </div>
            <label className="em-check">
              <input
                type="checkbox"
                checked={step.completed}
                disabled={step.completed || busy}
                onChange={() => void toggle(step.id)}
              />
              <span className="sr">{step.completed ? "Done" : "Mark done"}</span>
            </label>
          </li>
        ))}
      </ol>
      {!allDone ? (
        <form className="em-skip" onSubmit={(event) => void skip(event)}>
          <button type="button" onClick={() => setSkipOpen((open) => !open)}>
            Skip with reason
          </button>
          {skipOpen ? (
            <>
              <label className="sr" htmlFor="em-skip-reason">
                Reason for skipping the remaining steps
              </label>
              <input
                id="em-skip-reason"
                value={reason}
                placeholder="Reason"
                onChange={(event) => setReason(event.target.value)}
              />
              <button type="submit" disabled={!reason.trim() || busy}>
                Skip remaining
              </button>
            </>
          ) : null}
        </form>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      <button type="button" className="primary em-next" disabled={!allDone && !skipped} onClick={() => void next()}>
        Next: kit
      </button>
    </StageCard>
  );
}
