import { useState } from "react";
import { Link } from "react-router-dom";
import { HRP_HAZARDS, HRP_HAZARDS_URL, type Alert, type HazardId, type MeasurementKey } from "../../contracts";
import {
  FIRST_SEED_DAY,
  MISSION_DAY_TODAY,
  SIM_CREW,
  missionDayLabel,
  missionDayOf,
  missionDayStart,
  resetDemoData,
  store,
  useLive,
} from "../../data/db";
import { AlertCard } from "../../ui/AlertCard";
import { MetricTrend } from "../../ui/MetricTrend";

const TREND_KEYS: MeasurementKey[] = [
  "heartRate",
  "systolicBP",
  "diastolicBP",
  "temperatureC",
  "bloodGlucose",
  "oxygenSat",
  "sleepHours",
  "moodScore",
];

const RANK: Record<Alert["severity"], number> = { act: 2, watch: 1 };

/** Act first, then newest first. */
function sortAlerts(a: Alert, b: Alert): number {
  return RANK[b.severity] - RANK[a.severity] || Date.parse(b.openedAt) - Date.parse(a.openedAt);
}

function hazardLabel(id: HazardId): string {
  return HRP_HAZARDS.find((h) => h.id === id)!.label;
}

interface HazardSummary {
  radiationMgy?: number;
  radiationRate?: number;
  psych?: { mood: number; stress: number; at: string };
  workoutsDone: number;
  workoutsPlanned: number;
  queued: number;
  checklistDone: number;
  checklistRequired: number;
}

async function loadSummary(): Promise<HazardSummary> {
  const crew = SIM_CREW.id;
  const weekStart = missionDayStart(FIRST_SEED_DAY).toISOString();
  const [radiation, psych, workouts, packets, checklist] = await Promise.all([
    store.listRadiation(crew, weekStart),
    store.listPsych(crew, weekStart),
    store.listWorkouts(crew, weekStart),
    store.listPackets(),
    store.listChecklist(String(MISSION_DAY_TODAY)),
  ]);
  const planned = workouts.filter((w) => w.plannedMinutes !== undefined);
  const required = checklist.filter((i) => i.required);
  const lastRad = radiation.at(-1);
  const lastPsych = psych.at(-1);
  return {
    radiationMgy: lastRad?.cumulativeMgy,
    radiationRate: lastRad?.rateUgyPerHour,
    psych: lastPsych ? { mood: lastPsych.mood, stress: lastPsych.stress, at: lastPsych.at } : undefined,
    workoutsDone: planned.filter((w) => w.completed).length,
    workoutsPlanned: planned.length,
    queued: packets.filter((p) => p.status === "queued" || p.status === "sending" || p.status === "failed").length,
    checklistDone: required.filter((i) => i.doneAt).length,
    checklistRequired: required.length,
  };
}

function HazardTile({ id, to, value, detail }: { id: HazardId; to: string; value: string; detail: string }) {
  return (
    <Link className="hazard-tile" to={to}>
      {/* Swap the label for Dev A's <HazardChip id={id} /> when src/ui/HazardChip lands (issue 1). */}
      <span className="hazard-chip small-chip">{hazardLabel(id)}</span>
      <span className="tile-value">{value}</span>
      <span className="muted small">{detail}</span>
    </Link>
  );
}

export function DashboardPage() {
  const [showAcked, setShowAcked] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { data: alerts } = useLive(() => store.listAlerts(SIM_CREW.id), []);
  const { data: summary } = useLive(loadSummary, []);

  const all = [...(alerts ?? [])].sort(sortAlerts);
  const open = all.filter((a) => !a.ackedAt);
  const acked = all.filter((a) => a.ackedAt);

  async function reset() {
    if (!window.confirm("Reset all demo data to the 7-day simulated mission? Anything you entered is cleared.")) return;
    setResetting(true);
    try {
      await resetDemoData();
    } finally {
      setResetting(false);
    }
  }

  return (
    <section className="dashboard">
      <header className="page-head">
        <div>
          <h1>
            Week {missionDayLabel(FIRST_SEED_DAY)} to {missionDayLabel(MISSION_DAY_TODAY)}
          </h1>
          <p className="muted">{SIM_CREW.displayName} (simulated)</p>
        </div>
        <button type="button" onClick={() => void reset()} disabled={resetting}>
          {resetting ? "Resetting…" : "Reset demo data"}
        </button>
      </header>

      <section className="dash-section">
        <div className="section-head">
          <h2>
            Open alerts <span className="count">{open.length}</span>
          </h2>
          <label className="small">
            <input type="checkbox" checked={showAcked} onChange={(e) => setShowAcked(e.target.checked)} /> Show
            acknowledged{acked.length ? ` (${acked.length})` : ""}
          </label>
        </div>
        {alerts && !open.length ? <p className="muted">No open alerts. Every reading is inside your personal baseline.</p> : null}
        <div className="alert-list">
          {open.map((a) => (
            <AlertCard key={a.id} alert={a} onAck={() => void store.ackAlert(a.id)} />
          ))}
          {showAcked ? acked.map((a) => <AlertCard key={a.id} alert={a} />) : null}
        </div>
        <p className="muted small footnote">
          Personal baseline: rolling 7-day mean and standard deviation after a 3-day burn-in. Watch at |z| ≥ 2, Act at
          |z| ≥ 3. This is not a NASA-validated diagnostic method.
        </p>
      </section>

      <section className="dash-section">
        <div className="section-head">
          <h2>By hazard</h2>
          <a className="small" href={HRP_HAZARDS_URL} target="_blank" rel="noreferrer">
            NASA HRP: 5 hazards of human spaceflight
          </a>
        </div>
        <div className="hazard-grid">
          <HazardTile
            id="radiation"
            to="/radiation"
            value={summary?.radiationMgy !== undefined ? `${summary.radiationMgy.toFixed(2)} mGy` : "–"}
            detail={
              summary?.radiationRate !== undefined
                ? `cumulative since log start · latest ${summary.radiationRate} µGy/h (simulated)`
                : "No readings yet"
            }
          />
          <HazardTile
            id="isolation"
            to="/psych"
            value={summary?.psych ? `Mood ${summary.psych.mood}/5` : "–"}
            detail={
              summary?.psych
                ? `stress ${summary.psych.stress}/5 · ${missionDayLabel(missionDayOf(summary.psych.at))}`
                : "No check-in yet"
            }
          />
          <HazardTile
            id="gravity"
            to="/fitness"
            value={summary ? `${summary.workoutsDone} of ${summary.workoutsPlanned}` : "–"}
            detail="planned exercise sessions completed this week"
          />
          <HazardTile
            id="distance"
            to="/sync"
            value={summary ? String(summary.queued) : "–"}
            detail="packets waiting to reach Earth"
          />
          <HazardTile
            id="environment"
            to="/checklist"
            value={summary ? `${summary.checklistDone} of ${summary.checklistRequired}` : "–"}
            detail={`required checklist items done today (${missionDayLabel(MISSION_DAY_TODAY)})`}
          />
        </div>
      </section>

      <section className="dash-section">
        <div className="section-head">
          <h2>Trends</h2>
          <span className="muted small">
            Line: readings · shaded: your μ ± 2σ · <span className="sev-dot watch" /> watch{" "}
            <span className="sev-dot act" /> act
          </span>
        </div>
        <div className="trend-grid">
          {TREND_KEYS.map((k) => (
            <MetricTrend key={k} crewId={SIM_CREW.id} metricKey={k} />
          ))}
        </div>
      </section>
    </section>
  );
}
