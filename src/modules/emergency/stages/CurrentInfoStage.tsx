import { useState } from "react";
import { KEY_LABELS, UNITS, type Alert, type MeasurementKey } from "../../../contracts";
import {
  MISSION_DAY_TODAY,
  SIM_CREW,
  missionDayLabel,
  missionDayOf,
  missionDayStart,
  store,
  useLive,
} from "../../../data/db";
import { AlertCard } from "../../../ui/AlertCard";
import { Chip } from "../../../ui/Chip";
import { errorMessage } from "../caseActions";
import { buildCurrentInfo } from "../currentInfo";
import { StageCard } from "../StageCard";

function whenLabel(iso?: string): string {
  if (!iso) return "No reading in the last 24 hours";
  return missionDayOf(iso) === MISSION_DAY_TODAY ? "Today" : missionDayLabel(missionDayOf(iso));
}

function fmtValue(value: number | undefined): string {
  if (value === undefined) return "–";
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}

function openFor(alerts: Alert[], key: MeasurementKey): Alert | undefined {
  const matches = alerts.filter((alert) => !alert.ackedAt && alert.key === key);
  return matches.find((alert) => !alert.caseId) ?? matches[0];
}

export function CurrentInfoStage({
  onBack,
  onContinue,
}: {
  onBack: () => Promise<void>;
  onContinue: (snapshot: string) => Promise<void>;
}) {
  const measurements = useLive(() => store.listMeasurements(SIM_CREW.id), []);
  const baselines = useLive(() => store.getBaselines(SIM_CREW.id), []);
  const alerts = useLive(() => store.listAlerts(SIM_CREW.id), []);
  const workouts = useLive(() => store.listWorkouts(SIM_CREW.id, missionDayStart(MISSION_DAY_TODAY).toISOString()), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const measurementRows = measurements.data;
  const baselineRows = baselines.data;
  const alertRows = alerts.data;
  const snapshot =
    measurementRows && baselineRows && alertRows ? buildCurrentInfo(measurementRows, baselineRows, alertRows) : undefined;
  const open = (alertRows ?? []).filter((alert) => !alert.ackedAt);
  const resistiveToday = (workouts.data ?? []).some((workout) => workout.kind === "resistive" && workout.completed);

  async function next() {
    if (!snapshot || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await onContinue(JSON.stringify(snapshot));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <StageCard kicker="3 Check" title="Current info" meta={<span className="muted small">Latest vs your own baseline</span>}>
      {!snapshot ? <p className="muted">Loading the last 24 hours…</p> : null}
      <div className="em-vitals">
        {(snapshot?.rows ?? []).map((row) => {
          const alert = openFor(alertRows ?? [], row.key);
          const hot = alert?.severity === "act";
          return (
            <article key={row.key} className={hot ? "em-vital is-act" : "em-vital"}>
              <div className="em-vital-top">
                <h3>{row.label}</h3>
                {alert ? (
                  <Chip tone={alert.severity}>{alert.severity === "act" ? "Act" : "Watch"}</Chip>
                ) : row.value !== undefined ? (
                  <span className="em-ok">Normal</span>
                ) : null}
              </div>
              <p className="em-vital-value">
                {fmtValue(row.value)} <span>{row.unit}</span>
              </p>
              <p className="muted small">
                {row.mean !== undefined ? `Your μ ${row.mean.toFixed(1)} · σ ${row.std?.toFixed(2) ?? "–"}` : "No personal baseline yet"}
                {alert?.zScore !== undefined ? ` · z ${alert.zScore.toFixed(2)}` : ""}
                {" · "}
                {whenLabel(row.takenAt)}
              </p>
            </article>
          );
        })}
      </div>
      {resistiveToday ? <p className="em-note">Resistive exercise session today</p> : null}
      {open.length > 0 ? (
        <div className="em-alert-list">
          {open.map((alert) => (
            <AlertCard key={alert.id} alert={alert} compact />
          ))}
        </div>
      ) : snapshot ? (
        <p className="muted">No open alerts.</p>
      ) : null}
      <p className="muted small">
        {KEY_LABELS.heartRate} is compared with this crew member's own recent readings ({UNITS.heartRate}). This is not a diagnosis.
      </p>
      {error ? <p className="error">{error}</p> : null}
      <div className="em-actions">
        <button type="button" onClick={() => void onBack()} disabled={busy}>
          Back
        </button>
        <button type="button" className="primary" onClick={() => void next()} disabled={!snapshot || busy}>
          {busy ? "Saving…" : "Next: differential"}
        </button>
      </div>
    </StageCard>
  );
}
