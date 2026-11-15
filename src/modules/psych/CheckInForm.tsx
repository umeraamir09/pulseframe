import { useState, type FormEvent } from "react";
import type { Alert, PsychCheck } from "../../contracts";
import { missionDayOf } from "../../data/db";
import { AlertCard } from "../../ui/AlertCard";
import { Scale5 } from "../../ui/controls";
import { HazardChip } from "../../ui/HazardChip";
import { Icon, type IconName } from "../../ui/Icon";
import { saveCheckIn, type PsychField } from "./saveCheckIn";

type Field = PsychField;

/** `goodHigh`: 5 is the good end, so the smile sits on the right. */
const FIELDS: { field: Field; label: string; icon: IconName; low: string; high: string; goodHigh: boolean }[] = [
  { field: "mood", label: "Mood", icon: "smile", low: "Low", high: "Great", goodHigh: true },
  { field: "sleepQuality", label: "Sleep quality", icon: "moon", low: "Poor", high: "Great", goodHigh: true },
  { field: "stress", label: "Stress", icon: "pulse", low: "Calm", high: "High", goodHigh: false },
  { field: "teamStrain", label: "Team strain", icon: "users", low: "Low", high: "High", goodHigh: false },
];

const DEFAULTS: Record<Field, number> = { mood: 3, stress: 3, teamStrain: 3, sleepQuality: 3 };

function MoodBars({ checks }: { checks: PsychCheck[] }) {
  const last = checks.slice(-7);
  return (
    <div className="mini-bars" role="img" aria-label={`Mood over the last ${last.length} check-ins: ${last.map((c) => c.mood).join(", ")}`}>
      {last.map((c, i) => (
        <div key={c.id}>
          <span className={i === last.length - 1 ? "on" : undefined} style={{ height: `${(c.mood / 5) * 72 + 8}px` }} />
          <small>{missionDayOf(c.at)}</small>
        </div>
      ))}
    </div>
  );
}

export function CheckInForm({ checks }: { checks: PsychCheck[] }) {
  const [values, setValues] = useState<Record<Field, number>>(DEFAULTS);
  const [note, setNote] = useState("");
  const [privateNote, setPrivateNote] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<{ alerts: Alert[]; at: string }>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const at = new Date().toISOString();
      const { alerts } = await saveCheckIn({ ...values, note, includeNote: !privateNote }, at);
      setResult({ alerts, at });
      setNote("");
      setPrivateNote(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="psych-grid" onSubmit={(e) => void submit(e)}>
      <section className="card pad-lg" aria-labelledby="checkin-title">
        <div className="card-head">
          <div className="titles">
            <p className="overline">Today</p>
            <h2 id="checkin-title" className="h2">
              How are you, 1 to 5?
            </h2>
          </div>
          <span className="tag">
            <Icon name="info" size={14} /> Self-report. Not WinSCAT, not a test.
          </span>
        </div>
        <div className="psych-rows">
          {FIELDS.map((f) => {
            const left: IconName = f.goodHigh ? "frown" : "smile";
            const right: IconName = f.goodHigh ? "smile" : "frown";
            return (
              <div key={f.field} className="psych-row">
                <div className="who">
                  <span className="icon-badge sm white sq" style={{ color: "var(--accent)" }}>
                    <Icon name={f.icon} size={18} />
                  </span>
                  {f.label}
                </div>
                <span className="face" aria-hidden="true">
                  <Icon name={left} size={36} strokeWidth={1.4} />
                </span>
                <Scale5
                  label={f.label}
                  value={values[f.field]}
                  onChange={(v) => setValues((cur) => ({ ...cur, [f.field]: v }))}
                  low={f.low}
                  high={f.high}
                />
                <span className="face" aria-hidden="true">
                  <Icon name={right} size={36} strokeWidth={1.4} />
                </span>
              </div>
            );
          })}
        </div>

        {result ? (
          <div className="stack" role="status" style={{ marginTop: 16 }}>
            {result.alerts.length ? (
              <>
                <p className="note watch">
                  <Icon name="alert" size={16} /> Saved. {result.alerts.length} answer{result.alerts.length > 1 ? "s are" : " is"} outside your
                  usual range.
                </p>
                <div className="alert-pattern-grid" style={{ marginTop: 0 }}>
                  {result.alerts.map((a) => (
                    <AlertCard key={a.id} alert={a} />
                  ))}
                </div>
              </>
            ) : (
              <p className="note normal">
                <Icon name="check" size={16} /> Saved. All four answers are within your usual range.
              </p>
            )}
          </div>
        ) : null}
      </section>

      <div className="psych-side">
        <section className="card" aria-labelledby="note-title">
          <div className="row" style={{ alignItems: "flex-start", gap: 12 }}>
            <span className="icon-badge sq">
              <Icon name="lock" size={18} />
            </span>
            <div className="grow">
              <h2 id="note-title" className="h3" style={{ fontSize: 16 }}>
                Private note
              </h2>
              <p className="muted small">{privateNote ? "Stays on station. Not sent to Earth." : "Shared in routine packets to the flight surgeon."}</p>
            </div>
            <button
              type="button"
              className="toggle"
              role="switch"
              aria-checked={privateNote}
              aria-label="Keep note private"
              onClick={() => setPrivateNote((p) => !p)}
            />
          </div>
          <label className="sr" htmlFor="psych-note">
            Note
          </label>
          <textarea
            id="psych-note"
            className="textarea soft"
            style={{ marginTop: 14 }}
            rows={4}
            placeholder={privateNote ? "Optional, only you can read it" : "Optional, the flight surgeon will see it"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </section>

        <section className="card log-card" style={{ flex: 1 }} aria-labelledby="mood-title">
          <h2 id="mood-title" className="muted" style={{ fontSize: 14, fontWeight: 500 }}>
            Mood, last {Math.min(7, checks.length)} check-ins
          </h2>
          {checks.length ? <MoodBars checks={checks} /> : <p className="muted small">No check-ins yet.</p>}
          <div>
            <HazardChip id="isolation" />
          </div>
          <span className="spacer" />
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" className="btn primary block" disabled={busy}>
            <Icon name="check" size={18} /> {busy ? "Saving…" : "Save check-in"}
          </button>
        </section>
      </div>
    </form>
  );
}
