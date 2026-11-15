import { useState } from "react";
import { KEY_LABELS, SKELETON_REGIONS, type Alert, type Baseline, type Measurement, type MeasurementKey, type SkeletonRegionId } from "../../contracts";
import { MISSION_DAY_TODAY, SIM_CREW, missionDayOf, store, useLive } from "../../data/db";
import { Chip } from "../../ui/Chip";
import { Scale5 } from "../../ui/controls";
import { Icon, type IconName } from "../../ui/Icon";
import { fmt } from "../../ui/useTrend";
import { SkeletonView } from "../skeleton/SkeletonView";
import { REGION_SHORT, toggleRegion } from "../skeleton/regions";
import { stageIndex, type CaseIntake, type EmergencyApi } from "./useEmergencyCase";

const QUICK: { label: string; icon: IconName }[] = [
  { label: "Chest pain", icon: "heart" },
  { label: "Breathing", icon: "lungs" },
  { label: "Injury", icon: "bandage" },
  { label: "Fever", icon: "thermo" },
  { label: "Other", icon: "plusCircle" },
];
const STARTED = ["Just now", "Under 1 h", "Today"];

/** Which body region an open alert points at. */
const KEY_REGION: Partial<Record<MeasurementKey, SkeletonRegionId>> = {
  heartRate: "chest",
  systolicBP: "chest",
  diastolicBP: "chest",
  oxygenSat: "chest",
  temperatureC: "skin",
};

function words(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function IntakePanel({ api }: { api: EmergencyApi }) {
  const { c, intake } = api;
  const [narrative, setNarrative] = useState(c?.narrative ?? "");
  const [details, setDetails] = useState<CaseIntake>(intake ?? { started: "Under 1 h", strength: 3 });
  const [busy, setBusy] = useState(false);
  const locked = c ? stageIndex(c.stage) >= stageIndex("differential") : false;

  function patch(p: Partial<CaseIntake>) {
    const next = { ...details, ...p };
    setDetails(next);
    if (c) void api.setIntake(next);
  }

  async function next() {
    if (!narrative.trim()) return;
    setBusy(true);
    try {
      await api.startCase(narrative, details);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card em-card" aria-labelledby="situation-title">
      <div className="titles">
        <p className="overline">1 Situation</p>
        <h2 id="situation-title" className="h2">
          What is happening?
        </h2>
      </div>
      <div className="narrative-box">
        <label className="sr" htmlFor="narrative">
          Describe what is happening
        </label>
        <textarea
          id="narrative"
          rows={2}
          value={narrative}
          readOnly={locked}
          placeholder="Describe it in a few words"
          onChange={(e) => setNarrative(e.target.value)}
          onBlur={() => {
            if (c && !locked && narrative.trim() && narrative.trim() !== c.narrative) void api.update({ narrative: narrative.trim() });
          }}
        />
        <p className="meta">
          <Icon name="edit" size={14} /> Typed by crew, {words(narrative)} words
        </p>
      </div>

      <div className="field">
        <span className="field-label">Quick pick</span>
        <div className="row wrap" role="radiogroup" aria-label="Quick pick">
          {QUICK.map((q) => (
            <button
              key={q.label}
              type="button"
              role="radio"
              aria-checked={details.quickPick === q.label}
              className="chip"
              disabled={locked}
              onClick={() => {
                patch({ quickPick: q.label });
                if (!narrative.trim() && q.label !== "Other") setNarrative(q.label);
              }}
            >
              <Icon name={q.icon} size={18} />
              {q.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">Started</span>
        <div className="row wrap" role="radiogroup" aria-label="Started">
          {STARTED.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={details.started === s}
              className="chip"
              disabled={locked}
              onClick={() => patch({ started: s })}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">How strong, 1 to 5</span>
        <Scale5 label="How strong" value={details.strength ?? 3} onChange={(v) => !locked && patch({ strength: v })} low="Mild" high="Severe" />
      </div>

      {!c ? (
        <button type="button" className="btn primary block" disabled={!narrative.trim() || busy} onClick={() => void next()}>
          <Icon name="arrowR" size={18} /> Next: pinpoint
        </button>
      ) : null}
    </section>
  );
}

export function PinpointPanel({ api, openAlerts }: { api: EmergencyApi; openAlerts: Alert[] }) {
  const { c } = api;
  const regions = c?.regionIds ?? [];
  const editable = Boolean(c) && stageIndex(c!.stage) < stageIndex("differential");
  const flagged = [...new Set(openAlerts.map((a) => KEY_REGION[a.key]).filter((r): r is SkeletonRegionId => Boolean(r)))];
  const toggle = (id: SkeletonRegionId) => {
    if (editable) void api.setRegions(toggleRegion(regions, id));
  };

  return (
    <div className="em-col">
      <div className="viewport-card">
        <SkeletonView selected={regions} onToggle={toggle} flagged={flagged} readOnly={!editable} />
      </div>
      <section className={`card pinpoint-card${c ? "" : " dim"}`} aria-labelledby="pinpoint-title">
        <div className="card-head" style={{ alignItems: "center" }}>
          <h2 id="pinpoint-title" className="h3" style={{ fontSize: 15 }}>
            2 Pinpoint a region
          </h2>
          <span className="muted small">{c ? "Tap the body or a pill" : "Describe the situation first"}</span>
        </div>
        <div className="region-pills" role="group" aria-label="Body regions">
          {SKELETON_REGIONS.map((id) => (
            <button
              key={id}
              type="button"
              className={`chip${flagged.includes(id) && !regions.includes(id) ? " flagged" : ""}`}
              aria-pressed={regions.includes(id)}
              disabled={!editable}
              onClick={() => toggle(id)}
            >
              {REGION_SHORT[id]}
            </button>
          ))}
        </div>
        {c?.stage === "pinpoint" ? (
          <button type="button" className="btn primary" disabled={!regions.length} onClick={() => void api.advance("current-info")}>
            <Icon name="arrowR" size={18} /> Next: check current info
          </button>
        ) : null}
      </section>
    </div>
  );
}

interface CurrentInfo {
  latest: Partial<Record<MeasurementKey, Measurement>>;
  baselines: Baseline[];
  resistiveToday: boolean;
}

const INFO_KEYS: MeasurementKey[] = ["heartRate", "systolicBP", "diastolicBP", "oxygenSat", "temperatureC", "sleepHours"];

async function loadInfo(): Promise<CurrentInfo> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [rows, baselines, workouts] = await Promise.all([
    store.listMeasurements(SIM_CREW.id, since),
    store.getBaselines(SIM_CREW.id),
    store.listWorkouts(SIM_CREW.id),
  ]);
  const latest: CurrentInfo["latest"] = {};
  for (const m of rows) if (!m.caseId && INFO_KEYS.includes(m.key)) latest[m.key] = m;
  return {
    latest,
    baselines,
    resistiveToday: workouts.some((w) => w.kind === "resistive" && w.completed && missionDayOf(w.at) === MISSION_DAY_TODAY),
  };
}

function VitalCard({
  icon,
  label,
  value,
  unit,
  caption,
  alert,
  mean,
}: {
  icon: IconName;
  label: string;
  value: string;
  unit: string;
  caption: string;
  alert?: Alert;
  mean?: number;
}) {
  return (
    <div className="vital-card">
      <div className="card-head">
        <span className="lbl">
          <Icon name={icon} size={16} />
          {label}
        </span>
        <Chip tone={alert?.severity ?? "normal"} size="sm" />
      </div>
      <div className="big-value">
        <span className={`numeral-m${alert?.severity === "act" ? " act" : ""}`} style={{ fontSize: 38 }}>
          {value}
        </span>
        <span className="unit">{unit}</span>
      </div>
      <span className="tag white" style={{ alignSelf: "flex-start" }}>
        {mean !== undefined && alert?.zScore !== undefined ? `Your μ ${fmt(mean)} · z ${alert.zScore.toFixed(2)}` : caption}
      </span>
    </div>
  );
}

export function CurrentInfoPanel({ api, openAlerts }: { api: EmergencyApi; openAlerts: Alert[] }) {
  const { c } = api;
  const { data } = useLive(loadInfo, []);
  const L = data?.latest ?? {};
  const mean = (k: MeasurementKey) => data?.baselines.find((b) => b.key === k)?.mean;
  const alertFor = (...keys: MeasurementKey[]) =>
    openAlerts.find((a) => keys.includes(a.key) && missionDayOf(a.openedAt) === MISSION_DAY_TODAY && !a.caseId);

  async function next() {
    const snapshot = INFO_KEYS.map((k) => ({
      key: k,
      label: KEY_LABELS[k],
      value: L[k]?.value,
      takenAt: L[k]?.takenAt,
      mean: mean(k),
      std: data?.baselines.find((b) => b.key === k)?.std,
    }));
    await api.advance("differential", {
      currentInfoSnapshot: JSON.stringify({ shown: snapshot, openAlertIds: openAlerts.map((a) => a.id) }),
    });
  }

  return (
    <section className={`card em-card${c ? "" : " dim"}`} aria-labelledby="check-title">
      <div className="titles">
        <p className="overline">3 Check</p>
        <h2 id="check-title" className="h2">
          Current info
        </h2>
        <p className="muted small">Latest vs your own baseline, last 24 h</p>
      </div>
      <VitalCard
        icon="heart"
        label="Heart rate, morning"
        value={fmt(L.heartRate?.value)}
        unit="bpm"
        caption="Today"
        alert={alertFor("heartRate")}
        mean={mean("heartRate")}
      />
      <VitalCard
        icon="gauge"
        label="Blood pressure"
        value={L.systolicBP ? `${fmt(L.systolicBP.value)}/${fmt(L.diastolicBP?.value)}` : "–"}
        unit="mmHg"
        caption="Today, seated"
        alert={alertFor("systolicBP", "diastolicBP")}
      />
      <VitalCard icon="lungs" label="SpO2" value={fmt(L.oxygenSat?.value)} unit="%" caption="Today" alert={alertFor("oxygenSat")} />
      <VitalCard
        icon="thermo"
        label="Temperature"
        value={fmt(L.temperatureC?.value)}
        unit="°C"
        caption="Today"
        alert={alertFor("temperatureC")}
      />
      {data?.resistiveToday ? (
        <p className="note watch pill">
          <Icon name="dumbbell" size={16} /> Resistive exercise session today
        </p>
      ) : null}
      {c?.stage === "current-info" ? (
        <button type="button" className="btn primary block" onClick={() => void next()}>
          <Icon name="arrowR" size={18} /> Next: differential
        </button>
      ) : null}
    </section>
  );
}
