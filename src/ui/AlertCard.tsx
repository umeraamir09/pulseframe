import { KEY_LABELS, type Alert } from "../contracts";
import { missionDayLabel, missionDayOf } from "../data/db";

/**
 * Personal-baseline alert card. Minimal version for the checklist; PF-5 (issue 7) extends it
 * with the Chip component and explainAlert.
 */
export function AlertCard({ alert, compact, onAck }: { alert: Alert; compact?: boolean; onAck?: () => void }) {
  const z = alert.ruleId === "z-watch" || alert.ruleId === "z-act";
  return (
    <div className={`alert-card ${alert.severity}`} role="status">
      <div className="alert-head">
        <span className={`chip ${alert.severity}`}>{alert.severity === "act" ? "Act" : "Watch"}</span>
        <strong>
          {KEY_LABELS[alert.key]} · {missionDayLabel(missionDayOf(alert.openedAt))}
        </strong>
      </div>
      {!compact && z && alert.mean !== undefined && alert.std !== undefined && alert.zScore !== undefined ? (
        <code className="formula">
          z = (x - μ) / σ = ({alert.value} - {alert.mean.toFixed(1)}) / {alert.std.toFixed(2)} = {alert.zScore.toFixed(2)}
        </code>
      ) : null}
      {alert.ruleId === "hard-bound" ? <p className="muted">Demonstration threshold, not a clinical limit</p> : null}
      <p>{alert.message}</p>
      {onAck ? (
        <button type="button" onClick={onAck}>
          Ack
        </button>
      ) : null}
    </div>
  );
}
