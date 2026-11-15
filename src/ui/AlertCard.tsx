import { KEY_LABELS, type Alert } from "../contracts";
import { explainAlert, missionDayLabel, missionDayOf } from "../data/db";
import { Chip } from "./Chip";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Personal-baseline alert card (Figma 10 alert pattern). Shared by the dashboard, checklist and emergency flow. */
export function AlertCard({ alert, compact, onAck }: { alert: Alert; compact?: boolean; onAck?: () => void }) {
  const isZ = alert.ruleId === "z-watch" || alert.ruleId === "z-act";
  const hasStats = alert.mean !== undefined && alert.std !== undefined && alert.zScore !== undefined;
  return (
    <article className={`alert-card ${alert.severity}${alert.ackedAt ? " acked" : ""}${compact ? " compact" : ""}`}>
      <div className="alert-head">
        <Chip tone={alert.severity}>{alert.severity === "act" ? "Act" : "Watch"}</Chip>
        <strong>
          {KEY_LABELS[alert.key]} · {missionDayLabel(missionDayOf(alert.openedAt))}
        </strong>
        {alert.caseId ? <span className="muted small">emergency test</span> : null}
        <span className="muted small alert-time">{fmtTime(alert.openedAt)}</span>
      </div>

      {!compact && isZ && hasStats ? (
        <>
          <code className="formula">
            z = (x - μ) / σ = ({alert.value} - {alert.mean!.toFixed(1)}) / {alert.std!.toFixed(2)} ={" "}
            {alert.zScore!.toFixed(2)}
          </code>
          <dl className="alert-stats">
            <div>
              <dt>x</dt>
              <dd>{alert.value}</dd>
            </div>
            <div>
              <dt>μ</dt>
              <dd>{alert.mean!.toFixed(2)}</dd>
            </div>
            <div>
              <dt>σ</dt>
              <dd>{alert.std!.toFixed(3)}</dd>
            </div>
            <div>
              <dt>z</dt>
              <dd>{alert.zScore!.toFixed(2)}</dd>
            </div>
            {alert.sampleCount !== undefined ? (
              <div>
                <dt>n</dt>
                <dd>
                  {alert.sampleCount} in {alert.windowDays ?? 7} d
                </dd>
              </div>
            ) : null}
          </dl>
        </>
      ) : null}
      {alert.ruleId === "hard-bound" ? <p className="muted small">Demonstration threshold, not a clinical limit</p> : null}

      <p className="alert-msg">{explainAlert(alert)}</p>

      {alert.ackedAt ? (
        <p className="muted small">Acknowledged {fmtTime(alert.ackedAt)}</p>
      ) : onAck ? (
        <div className="row-actions start">
          <button type="button" onClick={onAck}>
            Ack
          </button>
        </div>
      ) : null}
    </article>
  );
}
