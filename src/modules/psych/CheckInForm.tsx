import { useState, type FormEvent } from "react";
import type { Alert } from "../../contracts";
import { AlertCard } from "../../ui/AlertCard";
import { saveCheckIn, type PsychField } from "./saveCheckIn";

type Field = PsychField;

const FIELDS: { field: Field; label: string; low: string; high: string }[] = [
  { field: "mood", label: "Mood", low: "1 low", high: "5 good" },
  { field: "stress", label: "Stress", low: "1 low", high: "5 high" },
  { field: "teamStrain", label: "Team strain", low: "1 low", high: "5 high" },
  { field: "sleepQuality", label: "Sleep quality", low: "1 poor", high: "5 good" },
];

const DEFAULTS: Record<Field, number> = { mood: 3, stress: 3, teamStrain: 3, sleepQuality: 3 };

export function CheckInForm() {
  const [values, setValues] = useState<Record<Field, number>>(DEFAULTS);
  const [note, setNote] = useState("");
  const [includeNote, setIncludeNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<{ alerts: Alert[]; at: string }>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const at = new Date().toISOString();
      const { alerts } = await saveCheckIn({ ...values, note, includeNote }, at);
      setResult({ alerts, at });
      setNote("");
      setIncludeNote(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="checkin" onSubmit={(e) => void submit(e)}>
      <h2>Today's check-in</h2>
      {FIELDS.map((f) => (
        <div key={f.field} className="slider-row">
          <label htmlFor={`psych-${f.field}`}>{f.label}</label>
          <div className="slider">
            <input
              id={`psych-${f.field}`}
              type="range"
              min={1}
              max={5}
              step={1}
              value={values[f.field]}
              onChange={(e) => setValues((v) => ({ ...v, [f.field]: Number(e.target.value) }))}
              aria-valuetext={`${values[f.field]} of 5`}
            />
            <div className="slider-scale muted small">
              <span>{f.low}</span>
              <span>{f.high}</span>
            </div>
          </div>
          <output htmlFor={`psych-${f.field}`} className="slider-value">
            {values[f.field]}
          </output>
        </div>
      ))}

      <label className="note-field">
        Note <span className="muted">(optional)</span>
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <label className="inline small">
        <input type="checkbox" checked={includeNote} onChange={(e) => setIncludeNote(e.target.checked)} /> Include note in
        Earth packets
      </label>
      <p className="muted small">
        {includeNote
          ? "The note is saved with this check-in and will be part of routine packets to the flight surgeon."
          : "The note stays private on board. It is not sent to Earth."}
      </p>

      <div className="row-actions start">
        <button type="submit" className="primary" disabled={busy}>
          {busy ? "Saving…" : "Save check-in"}
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}

      {result ? (
        <div className="checkin-result" role="status">
          {result.alerts.length ? (
            <>
              <p>
                Saved. {result.alerts.length} reading{result.alerts.length > 1 ? "s are" : " is"} outside your usual
                range:
              </p>
              {result.alerts.map((a) => (
                <AlertCard key={a.id} alert={a} />
              ))}
            </>
          ) : (
            <p className="muted">Saved. All four answers are within your usual range.</p>
          )}
        </div>
      ) : null}
    </form>
  );
}
