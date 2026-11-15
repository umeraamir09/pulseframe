import { useState } from "react";
import { UNITS, type Alert, type ProtocolStep } from "../../../contracts";
import { SIM_CREW, store, useLive } from "../../../data/db";
import { AlertCard } from "../../../ui/AlertCard";
import { errorMessage } from "../caseActions";
import { MiniProgress, StageCard } from "../StageCard";

export function TestsStage({
  steps,
  onSave,
  onDone,
  onContinue,
  onGotoSteps,
}: {
  steps: ProtocolStep[];
  onSave: (step: ProtocolStep, value: number) => Promise<Alert | undefined>;
  onDone: (stepId: string) => Promise<void>;
  onContinue: () => Promise<void>;
  onGotoSteps: () => Promise<void>;
}) {
  const alerts = useLive(() => store.listAlerts(SIM_CREW.id), []);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [raised, setRaised] = useState<Record<string, Alert>>({});
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();
  const done = steps.filter((step) => step.completed).length;

  function alertFor(step: ProtocolStep): Alert | undefined {
    const fromStore = (alerts.data ?? []).find((alert) => step.measurementId && alert.measurementId === step.measurementId);
    return fromStore ?? raised[step.id];
  }

  async function save(step: ProtocolStep) {
    const raw = drafts[step.id] ?? (step.resultValue !== undefined ? String(step.resultValue) : "");
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      setError(`Enter a number for ${step.title}.`);
      return;
    }
    setBusyId(step.id);
    setError(undefined);
    try {
      const alert = await onSave(step, value);
      if (alert) setRaised((current) => ({ ...current, [step.id]: alert }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(undefined);
    }
  }

  async function go(action: () => Promise<void>) {
    setError(undefined);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <StageCard kicker="5 Tests" title="Run these checks" meta={<MiniProgress done={done} total={steps.length} />}>
      <ol className="em-test-list">
        {steps.map((step, index) => {
          const alert = alertFor(step);
          const unit = step.inputKey ? UNITS[step.inputKey] : "";
          const value = drafts[step.id] ?? (step.resultValue !== undefined ? String(step.resultValue) : "");
          return (
            <li key={step.id} className={alert?.severity === "act" ? "em-test is-act" : "em-test"}>
              <div className="em-test-main">
                <span className="em-num" aria-hidden="true">
                  {index + 1}
                </span>
                <div className="em-test-copy">
                  <h3>{step.title}</h3>
                  <p>{step.instruction}</p>
                </div>
                {step.inputKey ? (
                  <div className="em-test-entry">
                    <label className="sr" htmlFor={`test-${step.id}`}>
                      {step.title} ({unit})
                    </label>
                    <input
                      id={`test-${step.id}`}
                      type="number"
                      inputMode="decimal"
                      value={value}
                      disabled={step.completed || busyId === step.id}
                      onChange={(event) => setDrafts((current) => ({ ...current, [step.id]: event.target.value }))}
                    />
                    <span className="muted">{unit}</span>
                    <button type="button" onClick={() => void save(step)} disabled={step.completed || busyId === step.id}>
                      {step.completed ? "Saved" : busyId === step.id ? "Saving…" : "Save"}
                    </button>
                  </div>
                ) : (
                  <label className="em-done">
                    <input
                      type="checkbox"
                      checked={step.completed}
                      disabled={step.completed}
                      onChange={() => void onDone(step.id).catch((err: unknown) => setError(errorMessage(err)))}
                    />
                    Done
                  </label>
                )}
              </div>
              {alert ? (
                <div className="em-test-alert">
                  {alert.mean !== undefined && alert.zScore !== undefined ? (
                    <p className="em-zrow">
                      <span>μ {alert.mean.toFixed(1)}</span>
                      <span className="em-z-x">
                        {alert.value} {unit}
                      </span>
                      <span className="em-z-n">z {alert.zScore.toFixed(2)}</span>
                    </p>
                  ) : null}
                  <AlertCard alert={alert} />
                  {alert.severity === "act" ? (
                    <button type="button" className="danger" onClick={() => void go(onGotoSteps)}>
                      Go to steps
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      {error ? <p className="error">{error}</p> : null}
      <button type="button" className="primary em-next" onClick={() => void go(onContinue)}>
        Next: steps
      </button>
    </StageCard>
  );
}
