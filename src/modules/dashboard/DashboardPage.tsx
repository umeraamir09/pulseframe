import { useState } from "react";
import { Link } from "react-router-dom";
import { HRP_HAZARDS_URL, KEY_LABELS, type Alert, type HazardId, type Measurement, type MeasurementKey } from "../../contracts";
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
import { AlertCard, AlertRow } from "../../ui/AlertCard";
import { Chip } from "../../ui/Chip";
import { Progress, Segmented } from "../../ui/controls";
import { HAZARD_ICONS, hazardLabel } from "../../ui/hazards";
import { Icon, type IconName } from "../../ui/Icon";
import { TrendChart } from "../../ui/MetricTrend";
import { fmt, useTrend } from "../../ui/useTrend";
import { usePageMeta } from "../../ui/pageMeta";
import { AiNoteList, AiNotesProvider, AiNotesRefresh } from "./AiNotes";
import { notesFor } from "./briefCopy";
import { useAiNotes } from "./useAiNotes";

const RANK: Record<Alert["severity"], number> = { act: 2, watch: 1 };

/** Act first, then newest first. */
function sortAlerts(a: Alert, b: Alert): number {
  return RANK[b.severity] - RANK[a.severity] || Date.parse(b.openedAt) - Date.parse(a.openedAt);
}

interface Summary {
  radiationRate?: number;
  psychDoneToday: boolean;
  workoutsDone: number;
  workoutsPlanned: number;
  checklistDone: number;
  checklistTotal: number;
  latest: Partial<Record<MeasurementKey, Measurement>>;
  resistiveToday: boolean;
}

const LATEST_KEYS: MeasurementKey[] = ["systolicBP", "diastolicBP", "temperatureC", "oxygenSat", "bloodGlucose"];

async function loadSummary(): Promise<Summary> {
  const crew = SIM_CREW.id;
  const weekStart = missionDayStart(FIRST_SEED_DAY).toISOString();
  const [radiation, psych, workouts, checklist, rows] = await Promise.all([
    store.listRadiation(crew, weekStart),
    store.listPsych(crew, weekStart),
    store.listWorkouts(crew, weekStart),
    store.listChecklist(String(MISSION_DAY_TODAY)),
    store.listMeasurements(crew, weekStart),
  ]);
  const planned = workouts.filter((w) => w.plannedMinutes !== undefined);
  const latest: Summary["latest"] = {};
  for (const m of rows) if (!m.caseId && LATEST_KEYS.includes(m.key)) latest[m.key] = m;
  return {
    radiationRate: radiation.at(-1)?.rateUgyPerHour,
    psychDoneToday: psych.some((p) => missionDayOf(p.at) === MISSION_DAY_TODAY),
    workoutsDone: planned.filter((w) => w.completed).length,
    workoutsPlanned: planned.length,
    checklistDone: checklist.filter((i) => i.doneAt).length,
    checklistTotal: checklist.length,
    latest,
    resistiveToday: workouts.some((w) => w.kind === "resistive" && w.completed && missionDayOf(w.at) === MISSION_DAY_TODAY),
  };
}

function when(m?: Measurement): string {
  if (!m) return "No reading yet";
  const md = missionDayOf(m.takenAt);
  return md === MISSION_DAY_TODAY ? "Today" : missionDayLabel(md);
}

function OpenAlerts({ open }: { open: Alert[] }) {
  const [first, ...rest] = open;
  return (
    <section className="card" aria-labelledby="open-alerts">
      <div className="card-head" style={{ alignItems: "center", marginBottom: 16 }}>
        <h2 id="open-alerts" className="h2">
          Open alerts
        </h2>
        <span className={`count-badge${open.length ? "" : " zero"}`} aria-label={`${open.length} open`}>
          {open.length}
        </span>
      </div>
      {!open.length ? (
        <p className="note normal">
          <Icon name="check" size={18} /> Every reading is inside your personal baseline.
        </p>
      ) : null}
      <div className="stack">
        {first ? <AlertCard alert={first} onAck={() => void store.ackAlert(first.id)} /> : null}
        {rest.map((a) => (
          <AlertRow key={a.id} alert={a} onAck={() => void store.ackAlert(a.id)} />
        ))}
      </div>
      {open.length ? (
        <Link to="/alerts" className="btn ghost sm block" style={{ marginTop: 12 }}>
          All alerts and the method
        </Link>
      ) : null}
    </section>
  );
}

function TrendCard({
  metric,
  title,
  icon,
  alert,
  days,
  note,
  noteKeys,
}: {
  metric: MeasurementKey;
  title: string;
  icon: IconName;
  alert?: Alert;
  days: number;
  note?: string;
  /** Measurement keys whose AI notes belong on this card. Defaults to `metric`. */
  noteKeys?: MeasurementKey[];
}) {
  const ai = useAiNotes();
  const aiNotes = notesFor(ai.byKey, noteKeys ?? [metric]);
  const trend = useTrend(SIM_CREW.id, metric, days);
  const latest = trend.latest;
  const base = trend.latestBaseline;
  const z = latest && base?.mean !== undefined && base.std ? (latest.value - base.mean) / base.std : undefined;
  const delta = latest && base?.mean !== undefined ? latest.value - base.mean : undefined;
  const sev = alert?.severity;
  const lastAlertPoint = [...trend.line].reverse().find((p) => p.severity);

  return (
    <section className="card trend-card" aria-label={`${title} trend`}>
      <div className="card-head" style={{ alignItems: "center" }}>
        <div className="row grow">
          <span className="icon-badge">
            <Icon name={icon} size={20} />
          </span>
          <h3 className="h3">{title}</h3>
        </div>
        {sev ? <Chip tone={sev} /> : <Chip tone="normal" />}
      </div>
      <div className="big-value">
        <span className="numeral-xl">{latest ? fmt(latest.value) : "–"}</span>
        <span className="unit">{trend.unit}</span>
        {note ? (
          <span className={`trend-delta ${sev ?? ""}`}>{note}</span>
        ) : delta !== undefined && sev ? (
          <span className={`trend-delta ${sev}`}>
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(1)} vs μ
          </span>
        ) : null}
      </div>
      <div className="chips">
        <span className="tag">μ {fmt(base?.mean)}</span>
        <span className="tag">σ {fmt(base?.std, 2)}</span>
        <span className="tag">{z !== undefined ? `z ${z.toFixed(2)}` : metric === "sleepHours" ? "Last night" : "Burn-in"}</span>
      </div>
      <TrendChart trend={trend} height={150} />
      {lastAlertPoint ? (
        <span className="sr">
          Latest flagged reading {fmt(lastAlertPoint.value)} {trend.unit}, {lastAlertPoint.severity}
        </span>
      ) : null}
      <AiNoteList notes={aiNotes} />
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
  unit,
  caption,
  alert,
  keys,
}: {
  icon: IconName;
  label: string;
  value: string;
  unit: string;
  caption: string;
  alert?: Alert;
  keys: MeasurementKey[];
}) {
  const aiNotes = notesFor(useAiNotes().byKey, keys);
  return (
    <section className="card metric-card">
      <div className="card-head">
        <span className="icon-badge sm">
          <Icon name={icon} size={18} />
        </span>
        <Chip tone={alert?.severity ?? "normal"} size="sm" />
      </div>
      <span className="label">{label}</span>
      <div className="big-value">
        <span className="numeral-l">{value}</span>
        <span className="unit">{unit}</span>
      </div>
      <span className="caption">{caption}</span>
      <AiNoteList notes={aiNotes} />
    </section>
  );
}

function TodayCard({ s }: { s?: Summary }) {
  const items: { to: string; icon: IconName; label: string; right: string; pct: number; tone?: "normal" | "watch" }[] = [
    {
      to: "/checklist",
      icon: "checklist",
      label: "Daily checklist",
      right: s ? `${s.checklistDone} of ${s.checklistTotal}` : "–",
      pct: s && s.checklistTotal ? (s.checklistDone / s.checklistTotal) * 100 : 0,
    },
    {
      to: "/fitness",
      icon: "dumbbell",
      label: "Fitness this week",
      right: s ? `${s.workoutsDone} of ${s.workoutsPlanned}` : "–",
      pct: s && s.workoutsPlanned ? (s.workoutsDone / s.workoutsPlanned) * 100 : 0,
      tone: "normal",
    },
    {
      to: "/psych",
      icon: "smile",
      label: "Psych check-in",
      right: s?.psychDoneToday ? "Done" : "Due today",
      pct: s?.psychDoneToday ? 100 : 2,
      tone: "watch",
    },
  ];
  const left = s ? s.checklistTotal - s.checklistDone : undefined;
  return (
    <section className="card">
      <div className="card-head" style={{ alignItems: "center" }}>
        <h2 className="h3" style={{ fontSize: 20 }}>
          Today, {missionDayLabel(MISSION_DAY_TODAY)}
        </h2>
        {left !== undefined ? <span className="muted small">{left} tasks left</span> : null}
      </div>
      <div className="today-list">
        {items.map((it) => (
          <Link key={it.to} to={it.to} className="today-item">
            <span className="icon-badge">
              <Icon name={it.icon} size={18} />
            </span>
            <span>
              <span className="top">
                <span>{it.label}</span>
                <span>{it.right}</span>
              </span>
              <Progress pct={it.pct} tone={it.tone} label={it.label} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Hazards({ s, openPsych }: { s?: Summary; openPsych: boolean }) {
  const tiles: { id: HazardId; to: string; dot: string; detail: string }[] = [
    {
      id: "radiation",
      to: "/radiation",
      dot: "accent",
      detail: s?.radiationRate !== undefined ? `${s.radiationRate} µGy/h, simulated` : "No reading yet",
    },
    {
      id: "isolation",
      to: "/psych",
      dot: s?.psychDoneToday && !openPsych ? "normal" : "watch",
      detail: s?.psychDoneToday ? "Checked in today" : "Check-in due today",
    },
    {
      id: "distance",
      to: "/emergency",
      dot: "normal",
      detail: "Onboard protocols, no live ground link",
    },
    {
      id: "gravity",
      to: "/fitness",
      dot: "normal",
      detail: s ? `Exercise ${s.workoutsDone} of ${s.workoutsPlanned}` : "–",
    },
    { id: "environment", to: "/checklist", dot: "", detail: "No env data in demo" },
  ];
  return (
    <section className="card" aria-labelledby="hazards">
      <div className="card-head" style={{ alignItems: "center" }}>
        <h2 id="hazards" className="h3" style={{ fontSize: 20 }}>
          NASA HRP five hazards
        </h2>
        <a className="muted small" href={HRP_HAZARDS_URL} target="_blank" rel="noreferrer">
          What Pulseframe tracks for each
        </a>
      </div>
      <div className="hazard-grid">
        {tiles.map((t) => (
          <Link key={t.id} to={t.to} className="hazard-tile">
            <span className="icon-badge">
              <Icon name={HAZARD_ICONS[t.id]} size={18} />
            </span>
            <span className="name">{hazardLabel(t.id)}</span>
            <span className="detail">
              <span className={`dot ${t.dot}`} aria-hidden="true" />
              {t.detail}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function DashboardPage() {
  usePageMeta(
    "Weekly dashboard",
    `Personal baseline alerts, ${missionDayLabel(FIRST_SEED_DAY)} to ${missionDayLabel(MISSION_DAY_TODAY)}`,
  );
  const [range, setRange] = useState<"week" | "today">("week");
  const [resetting, setResetting] = useState(false);
  const { data: alerts } = useLive(() => store.listAlerts(SIM_CREW.id), []);
  const { data: summary } = useLive(loadSummary, []);

  const open = [...(alerts ?? [])].filter((a) => !a.ackedAt).sort(sortAlerts);
  const latestAlert = (key: MeasurementKey) =>
    open.find((a) => a.key === key && missionDayOf(a.openedAt) === MISSION_DAY_TODAY) ??
    (key === "sleepHours" ? open.find((a) => a.key === key) : undefined);
  const sleepAlerts = (alerts ?? []).filter((a) => a.key === "sleepHours" && missionDayOf(a.openedAt) >= FIRST_SEED_DAY).length;
  const days = range === "week" ? MISSION_DAY_TODAY - FIRST_SEED_DAY + 1 : 1;
  const L = summary?.latest ?? {};

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
    <AiNotesProvider>
      <div className="dash-grid">
        <div className="dash-left">
          <OpenAlerts open={open} />
          <TodayCard s={summary} />
        </div>

        <div className="dash-right">
          <div className="dash-toolbar">
            <Segmented
              label="Range"
              value={range}
              onChange={setRange}
              options={[
                { value: "week", label: "Week" },
                { value: "today", label: "Today" },
              ]}
            />
            <span className="muted">Band = your own μ ± 2σ. Not population norms.</span>
            <AiNotesRefresh />
            <button type="button" className="btn secondary" onClick={() => void reset()} disabled={resetting}>
              <Icon name="reset" size={18} />
              {resetting ? "Resetting…" : "Reset demo data"}
            </button>
          </div>

          <div className="trend-pair">
            <TrendCard metric="heartRate" title="Heart rate, morning" icon="heart" alert={latestAlert("heartRate")} days={days} />
            <TrendCard
              metric="sleepHours"
              title="Sleep"
              icon="moon"
              alert={[...open].filter((a) => a.key === "sleepHours").sort((a, b) => b.openedAt.localeCompare(a.openedAt))[0]}
              days={days}
              note={sleepAlerts ? `${sleepAlerts} alert${sleepAlerts === 1 ? "" : "s"} this week` : undefined}
              noteKeys={["sleepHours", "sleepQuality"]}
            />
          </div>

          <div className="metric-row">
            <MetricCard
              icon="gauge"
              label="Blood pressure"
              value={L.systolicBP ? `${fmt(L.systolicBP.value)}/${fmt(L.diastolicBP?.value)}` : "–"}
              unit="mmHg"
              caption={`${when(L.systolicBP)}, seated`}
              alert={latestAlert("systolicBP") ?? latestAlert("diastolicBP")}
              keys={["systolicBP", "diastolicBP"]}
            />
            <MetricCard
              icon="thermo"
              label={KEY_LABELS.temperatureC.replace("Body t", "T")}
              value={fmt(L.temperatureC?.value)}
              unit="°C"
              caption={when(L.temperatureC)}
              alert={latestAlert("temperatureC")}
              keys={["temperatureC"]}
            />
            <MetricCard
              icon="lungs"
              label="SpO2"
              value={fmt(L.oxygenSat?.value)}
              unit="%"
              caption={when(L.oxygenSat)}
              alert={latestAlert("oxygenSat")}
              keys={["oxygenSat"]}
            />
            <MetricCard
              icon="drop"
              label="Glucose"
              value={fmt(L.bloodGlucose?.value)}
              unit="mg/dL"
              caption={L.bloodGlucose ? `Fasting, ${when(L.bloodGlucose).replace("Today", "today")}` : when()}
              alert={latestAlert("bloodGlucose")}
              keys={["bloodGlucose"]}
            />
          </div>

          <Hazards s={summary} openPsych={open.some((a) => ["moodScore", "stressScore", "teamStrain", "sleepQuality"].includes(a.key))} />
        </div>
      </div>
    </AiNotesProvider>
  );
}
