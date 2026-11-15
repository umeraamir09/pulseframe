import { useState } from "react";
import { KEY_LABELS, type Alert } from "../contracts";
import { explainAlert, missionDayLabel, missionDayOf } from "../data/db";
import { SCALE_KEYS, caption, fmtValue, shortLine } from "./alertFormat";
import { Chip } from "./Chip";
import { Icon } from "./Icon";

/** Band shown on the alert bar: μ ± 6σ end to end, so the μ ± 2σ normal band sits in the middle third. */
const SPAN_SIGMA = 6;

function BandBar({ alert }: { alert: Alert }) {
  if (alert.mean === undefined || alert.std === undefined || alert.std <= 0) return null;
  const lo = alert.mean - SPAN_SIGMA * alert.std;
  const span = 2 * SPAN_SIGMA * alert.std;
  const pos = (v: number) => Math.max(1.5, Math.min(98.5, ((v - lo) / span) * 100));
  const bandL = pos(alert.mean - 2 * alert.std);
  const bandR = pos(alert.mean + 2 * alert.std);
  return (
    <div className="band-bar" aria-hidden="true">
      <span className="track" />
      <span className="band" style={{ left: `${bandL}%`, width: `${bandR - bandL}%` }} />
      <span className="mean" style={{ left: `${pos(alert.mean)}%` }} />
      <span className={`val ${alert.ackedAt ? "" : alert.severity}`} style={{ left: `${pos(alert.value)}%` }} />
    </div>
  );
}

/**
 * Personal-baseline alert card (Figma 10 alert pattern): Act, Watch, Hard bound, Acknowledged.
 * Shared by the dashboard, the alerts page, the checklist and the emergency flow.
 */
export function AlertCard({ alert, compact, onAck }: { alert: Alert; compact?: boolean; onAck?: () => void }) {
  const [why, setWhy] = useState(false);
  const isZ = alert.ruleId === "z-watch" || alert.ruleId === "z-act";
  const hasStats = isZ && alert.mean !== undefined && alert.std !== undefined && alert.zScore !== undefined;
  const isScale = SCALE_KEYS.includes(alert.key);
  const tone = alert.ackedAt ? "neutral" : alert.severity;
  const md = missionDayLabel(missionDayOf(alert.openedAt));

  return (
    <article className={`alert-card ${alert.severity}${alert.ackedAt ? " acked" : ""}${compact ? " compact" : ""}`}>
      <div className="alert-top">
        <Chip tone={tone}>{alert.ackedAt ? "Acknowledged" : undefined}</Chip>
        <span className="alert-title">{KEY_LABELS[alert.key]}</span>
        <span className="alert-md">
          {alert.caseId ? "Emergency test · " : ""}
          {md}
        </span>
      </div>

      <div className="alert-value">
        <div>
          <div className={compact ? "numeral-m" : "numeral-xl"}>
            {isScale ? (
              <>
                {fmtValue(alert.value)} of 5
              </>
            ) : (
              fmtValue(alert.value)
            )}
          </div>
          <div className="caption">{caption(alert)}</div>
        </div>
        {hasStats ? (
          <span className={`z-pill ${tone}`}>
            <small>z</small>
            {alert.zScore!.toFixed(2)}
          </span>
        ) : alert.ruleId === "hard-bound" ? (
          <span className="tag watch">
            <Icon name="flask" size={14} /> Demonstration threshold
          </span>
        ) : null}
      </div>

      {hasStats ? (
        <>
          <BandBar alert={alert} />
          <div className="alert-stats">
            <span>
              Your usual μ <b>{alert.mean!.toFixed(alert.mean! >= 10 ? 1 : 2)}</b> ± σ <b>{alert.std!.toFixed(2)}</b>
            </span>
            <span className="faint">z = (x − μ) / σ</span>
          </div>
        </>
      ) : null}

      <p className="alert-msg">
        {alert.ackedAt
          ? `Acked by Crew A, logged for Earth.`
          : shortLine(alert)}
      </p>

      {why ? (
        <div className="alert-why" id={`why-${alert.id}`}>
          {hasStats ? (
            <code>
              z = ({fmtValue(alert.value)} − {alert.mean!.toFixed(2)}) / {alert.std!.toFixed(3)} = {alert.zScore!.toFixed(2)}
            </code>
          ) : null}
          {alert.sampleCount !== undefined ? (
            <span>
              Baseline from {alert.sampleCount} readings over {alert.windowDays ?? 7} days.
            </span>
          ) : null}
          <span>{explainAlert(alert)}</span>
          {alert.ruleId === "hard-bound" ? <span>Demonstration threshold, not a clinical limit.</span> : null}
        </div>
      ) : null}

      {!compact || onAck ? (
        <div className="alert-actions">
          {alert.ackedAt ? (
            <span className="btn secondary sm" aria-disabled="true">
              <Icon name="check" size={18} /> Acknowledged
            </span>
          ) : onAck ? (
            <button type="button" className="btn secondary sm" onClick={onAck}>
              <Icon name="check" size={18} /> Ack
            </button>
          ) : null}
          <button
            type="button"
            className="btn ghost sm"
            aria-expanded={why}
            aria-controls={`why-${alert.id}`}
            onClick={() => setWhy((w) => !w)}
          >
            Why?
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn ghost xs"
          style={{ alignSelf: "flex-start" }}
          aria-expanded={why}
          onClick={() => setWhy((w) => !w)}
        >
          Why?
        </button>
      )}
    </article>
  );
}

/** Compact row for the dashboard's open-alert list. */
export function AlertRow({ alert, onAck }: { alert: Alert; onAck?: () => void }) {
  const md = missionDayLabel(missionDayOf(alert.openedAt));
  const detail =
    alert.zScore !== undefined && alert.ruleId !== "hard-bound" ? `z ${alert.zScore.toFixed(2)}` : "Demo threshold";
  return (
    <div className="alert-row">
      <div className="grow">
        <Chip tone={alert.severity} size="sm" />
        <div className="name">{KEY_LABELS[alert.key]}</div>
      </div>
      <span className="meta">
        {md} · {detail}
      </span>
      {onAck ? (
        <button type="button" className="btn secondary sm" onClick={onAck} aria-label={`Acknowledge ${KEY_LABELS[alert.key]} ${md}`}>
          Ack
        </button>
      ) : null}
    </div>
  );
}
