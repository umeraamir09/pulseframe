import { useState } from "react";
import { UNITS, type ProtocolStep, type SkeletonRegionId } from "../../../contracts";
import { store, useLive } from "../../../data/db";
import { Chip } from "../../../ui/Chip";
import { REGION_LABELS } from "../../skeleton/regions";
import { errorMessage } from "../caseActions";
import { StageCard } from "../StageCard";

export function HandoffStage({
  caseId,
  narrative,
  regions,
  steps,
  hasSnapshot,
  onSend,
}: {
  caseId: string;
  narrative: string;
  regions: readonly SkeletonRegionId[];
  steps: readonly ProtocolStep[];
  hasSnapshot: boolean;
  onSend: () => Promise<void>;
}) {
  const recommendations = useLive(() => store.listRecommendations(caseId), [caseId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const tests = steps.filter((step) => step.kind === "test" && step.completed);
  const actions = steps.filter((step) => step.kind === "action" && step.completed);
  const checks = [
    { label: "Summary", ok: narrative.trim().length > 0 },
    { label: "Vitals, tests", ok: tests.length > 0 },
    { label: "Current info", ok: hasSnapshot },
    { label: "Kit notes", ok: (recommendations.data ?? []).length > 0 },
  ];

  async function send() {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await onSend();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <StageCard kicker="8 Send" title="Flight surgeon handoff" meta={<Chip tone="act">Act</Chip>}>
      <ul className="em-checks">
        {checks.map((check) => (
          <li key={check.label} className={check.ok ? "is-on" : undefined}>
            <span aria-hidden="true">{check.ok ? "✓" : "–"}</span>
            {check.label}
          </li>
        ))}
      </ul>
      <h3 className="em-subhead">Summary</h3>
      <p>{narrative}</p>
      <h3 className="em-subhead">Regions</h3>
      <p>{regions.length > 0 ? regions.map((id) => REGION_LABELS[id]).join(", ") : "None selected."}</p>
      <h3 className="em-subhead">Test results</h3>
      {tests.length === 0 ? (
        <p className="muted">No test saved yet.</p>
      ) : (
        <ul className="em-result-list">
          {tests.map((step) => (
            <li key={step.id}>
              {step.title}: {step.resultValue ?? "done"}
              {step.inputKey ? ` ${UNITS[step.inputKey]}` : ""}
            </li>
          ))}
        </ul>
      )}
      <h3 className="em-subhead">Steps done</h3>
      {actions.length === 0 ? (
        <p className="muted">No immediate step checked yet.</p>
      ) : (
        <ul className="em-result-list">
          {actions.map((step) => (
            <li key={step.id}>{step.title}</li>
          ))}
        </ul>
      )}
      <p className="muted small">High priority · ready to queue · one emergency packet for this case.</p>
      {error ? <p className="error">{error}</p> : null}
      <button type="button" className="danger em-next" onClick={() => void send()} disabled={busy}>
        {busy ? "Sending…" : "Send to flight surgeon (high priority)"}
      </button>
    </StageCard>
  );
}
