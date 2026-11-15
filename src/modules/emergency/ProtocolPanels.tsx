import { useState, type FormEvent } from "react";
import { UNITS, type Alert, type MeasurementKey, type ProtocolStep } from "../../contracts";
import { SIM_CREW, explainAlert, store, useLive } from "../../data/db";
import { UnitInput } from "../../ui/controls";
import { Icon, type IconName } from "../../ui/Icon";
import { fmtValue } from "../../ui/alertFormat";
import { REGION_SHORT } from "../skeleton/regions";
import { ProtocolDetails } from "./ProtocolDetails";
import { scoreAgainst, stageIndex, type EmergencyApi } from "./useEmergencyCase";

function diffIcon(label: string): IconName {
  const l = label.toLowerCase();
  if (/muscle|strain|wall/.test(l)) return "dumbbell";
  if (/cardiac|heart/.test(l)) return "heart";
  if (/breath|lung|airway/.test(l)) return "lungs";
  if (/stress|anxiety/.test(l)) return "smile";
  return "stetho";
}

/** "Cardiac cause. Cannot be ruled out onboard." -> title "Cardiac cause", rest "Cannot be ruled out onboard." */
function splitLabel(label: string): { title: string; rest: string } {
  const i = label.indexOf(". ");
  return i === -1 ? { title: label, rest: "" } : { title: label.slice(0, i), rest: label.slice(i + 2) };
}

export function DifferentialPanel({ api, openAlerts }: { api: EmergencyApi; openAlerts: Alert[] }) {
  const { c, card } = api;
  const [open, setOpen] = useState<number | null>(null);
  if (!c || !card) return null;
  const facts = [
    ...c.regionIds.map((r) => `Pinpoint ${REGION_SHORT[r].toLowerCase()}`),
    ...(/exercis|exert|resistive|workout/i.test(c.narrative) ? ["After exertion"] : []),
    ...(openAlerts.some((a) => a.key === "heartRate") ? ["HR above baseline"] : []),
  ];

  return (
    <section className="card em-card" aria-labelledby="diff-title">
      <div className="titles">
        <p className="overline">4 Differential</p>
        <h2 id="diff-title" className="h2">
          Working differential, not a diagnosis
        </h2>
      </div>
      <span className="tag" style={{ alignSelf: "flex-start", height: 30, padding: "0 12px", fontSize: 13 }}>
        <Icon name="info" size={14} /> Unranked. Tests on the right help tell them apart.
      </span>
      {facts.length ? (
        <div className="evidence" aria-label="Case facts">
          {facts.map((f) => (
            <span key={f} style={{ background: "var(--surface2)" }}>
              <Icon name="check" size={12} /> {f}
            </span>
          ))}
        </div>
      ) : null}
      {card.differential.map((d, i) => {
        const { title, rest } = splitLabel(d.label);
        return (
          <div key={d.label} className="diff-card">
            <div className="card-head">
              <span className="icon-badge white sq">
                <Icon name={diffIcon(d.label)} size={20} />
              </span>
              <h3 className="h3">{title}</h3>
              <button
                type="button"
                className="btn ghost xs"
                style={{ background: "transparent", fontSize: 15 }}
                aria-expanded={open === i}
                onClick={() => setOpen(open === i ? null : i)}
              >
                Why?
              </button>
            </div>
            {open === i ? (
              <p className="muted small">
                {rest ? `${rest}. ` : ""}
                {d.note}
              </p>
            ) : null}
          </div>
        );
      })}
      <ProtocolDetails card={card} />
      <p className="muted small">{card.cautions}</p>
      <p className="note act">
        <Icon name="alert" size={16} /> Any Act result: go to steps now.
      </p>
      {c.stage === "differential" ? (
        <button type="button" className="btn primary block" onClick={() => void api.advance("tests")}>
          <Icon name="arrowR" size={18} /> Next: tests
        </button>
      ) : null}
    </section>
  );
}

const TEST_ICON: Partial<Record<MeasurementKey, IconName>> = {
  heartRate: "heart",
  systolicBP: "gauge",
  diastolicBP: "gauge",
  oxygenSat: "lungs",
  temperatureC: "thermo",
  painScore: "target",
};

const SHORT: Partial<Record<MeasurementKey, string>> = {
  heartRate: "Heart rate",
  systolicBP: "Systolic BP",
  diastolicBP: "Diastolic BP",
  oxygenSat: "SpO2",
  temperatureC: "Temperature",
  painScore: "Pain",
};

function TestCard({
  step,
  n,
  alert,
  api,
}: {
  step: ProtocolStep;
  n: number;
  alert?: Alert;
  api: EmergencyApi;
}) {
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [why, setWhy] = useState(false);
  const key = step.inputKey;
  const unit = key ? UNITS[key] : "";
  const tone = alert && !alert.ackedAt ? alert.severity : undefined;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!key || !api.c) return;
    const v = Number(value);
    if (value.trim() === "" || !Number.isFinite(v)) {
      setError("Enter a number.");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const at = new Date().toISOString();
      const { measurement } = await store.recordMeasurement({
        crewId: SIM_CREW.id,
        key,
        value: v,
        unit,
        source: "emergency-test",
        takenAt: at,
        caseId: api.c.id,
      });
      await api.saveStep({ ...step, completed: true, resultValue: v, measurementId: measurement.id, completedAt: at });
      if (stageIndex(api.c.stage) < stageIndex("tests")) await api.advance("tests");
      setValue("");
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleDone() {
    await api.saveStep({ ...step, completed: !step.completed, completedAt: step.completed ? undefined : new Date().toISOString() });
  }

  /** Tests with no measurement key take an optional short note (a grade, a count) and are marked done. */
  async function saveNote(e: FormEvent) {
    e.preventDefault();
    if (!api.c) return;
    const note = value.trim();
    await api.saveStep({ ...step, completed: true, resultNote: note || undefined, completedAt: new Date().toISOString() });
    if (stageIndex(api.c.stage) < stageIndex("tests")) await api.advance("tests");
    setValue("");
    setEditing(false);
  }

  const showInput = key && (!step.completed || editing);
  const showNoteInput = !key && (!step.completed || editing);

  return (
    <div className={`test-card${tone ? ` ${tone}` : ""}${step.completed && !tone ? " done" : ""}`}>
      <div className="test-main">
        <span className="icon-badge lg sq">
          <Icon name={key ? (TEST_ICON[key] ?? "stetho") : "check"} size={22} />
        </span>
        <div className="txt">
          <div className="t">
            <span className="num-dot ink">{n}</span>
            {step.title}
          </div>
          <p className="d">{step.instruction}</p>
        </div>
        {showInput ? (
          <form className="test-entry" onSubmit={(e) => void save(e)}>
            <span className="field-label">{key ? SHORT[key] : ""}</span>
            <div className="row">
              <UnitInput unit={unit} placeholder="Enter value" value={value} onChange={(e) => setValue(e.target.value)} aria-label={step.title} />
              <button type="submit" className="btn primary sm" disabled={busy} aria-label={`Save ${step.title}`}>
                <Icon name="check" size={18} />
              </button>
            </div>
            {error ? <span className="error">{error}</span> : null}
          </form>
        ) : key && step.resultValue !== undefined ? (
          <div className="test-entry">
            <span className="field-label">{SHORT[key]}</span>
            <button type="button" className="unit-input" style={{ cursor: "pointer" }} onClick={() => setEditing(true)} title="Re-enter">
              <span style={{ flex: 1, textAlign: "left", fontSize: 20, fontWeight: 500 }}>{fmtValue(step.resultValue)}</span>
              <span className="u">{unit}</span>
            </button>
          </div>
        ) : showNoteInput ? (
          <form className="test-entry" onSubmit={(e) => void saveNote(e)}>
            <span className="field-label">Result</span>
            <div className="row">
              <label className="unit-input">
                <input type="text" maxLength={40} placeholder="Optional" value={value} onChange={(e) => setValue(e.target.value)} aria-label={step.title} />
              </label>
              <button type="submit" className="btn primary sm" aria-label={`Mark ${step.title} done`}>
                <Icon name="check" size={18} />
              </button>
            </div>
          </form>
        ) : !key && step.resultNote ? (
          <div className="test-entry">
            <span className="field-label">Result</span>
            <button type="button" className="unit-input" style={{ cursor: "pointer" }} onClick={() => setEditing(true)} title="Re-enter">
              <span style={{ flex: 1, textAlign: "left", fontSize: 18, fontWeight: 500 }}>{step.resultNote}</span>
            </button>
          </div>
        ) : !key ? (
          <button type="button" className="step-check" aria-pressed={step.completed} aria-label={`Mark ${step.title} not done`} onClick={() => void toggleDone()}>
            <Icon name="check" size={24} />
          </button>
        ) : null}
      </div>

      {tone && alert ? (
        <div className={`test-result ${tone}`}>
          <div className="h">
            <span className={`status-chip ${tone}`} style={{ background: "transparent", padding: 0 }}>
              <span className="dot" /> {tone === "act" ? "Act" : "Watch"}
            </span>
            {tone === "act" ? "Far above your resting baseline" : "Above your resting baseline"}
            <span className="formula">z = (x − μ) / σ</span>
          </div>
          <div className="vals">
            {alert.mean !== undefined ? (
              <span className="mu">
                <span className="muted">μ</span> {alert.mean.toFixed(1)}
              </span>
            ) : null}
            <Icon name="arrowR" size={18} className="faint" />
            <span className="x">
              <span style={{ opacity: 0.8 }}>x</span> {fmtValue(alert.value)} {unit}
            </span>
            {alert.zScore !== undefined ? (
              <span className="z">
                <small>z</small>
                {alert.zScore.toFixed(2)}
              </span>
            ) : null}
            <span className="grow" />
            <button type="button" className="btn secondary" aria-expanded={why} onClick={() => setWhy((w) => !w)}>
              Why?
            </button>
            <button type="button" className="btn danger" onClick={() => void api.advance("immediate")}>
              <Icon name="arrowR" size={18} /> Go to steps
            </button>
          </div>
          {why ? <p className="small">{explainAlert(alert)}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function TestsPanel({ api, alerts }: { api: EmergencyApi; alerts: Alert[] }) {
  const tests = api.steps.filter((s) => s.kind === "test");
  const done = tests.filter((s) => s.completed).length;
  const byMeasurement = new Map(alerts.filter((a) => a.measurementId).map((a) => [a.measurementId!, a]));
  const { data: baselines } = useLive(() => store.getBaselines(SIM_CREW.id), []);
  const canNext = api.c && stageIndex(api.c.stage) < stageIndex("immediate");

  return (
    <section className="card em-card" aria-labelledby="tests-title">
      <div className="card-head" style={{ alignItems: "flex-end" }}>
        <div className="titles">
          <p className="overline">5 Tests</p>
          <h2 id="tests-title" className="h2">
            Run these checks
          </h2>
        </div>
        <span className="muted small">
          {done} of {tests.length} done
        </span>
      </div>
      {tests.map((s, i) => (
        <TestCard
          key={s.id}
          step={s}
          n={i + 1}
          api={api}
          alert={(s.measurementId ? byMeasurement.get(s.measurementId) : undefined) ?? scoreAgainst(s, baselines ?? [])}
        />
      ))}
      {canNext ? (
        <button type="button" className="btn primary" style={{ alignSelf: "flex-end" }} onClick={() => void api.advance("immediate")}>
          <Icon name="arrowR" size={18} /> Next: steps
        </button>
      ) : null}
    </section>
  );
}
