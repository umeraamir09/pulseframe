import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { Workout, WorkoutKind } from "../../contracts";
import { DEMO_WORKOUT_PLAN, EXERCISE_DEVICES, MISSION_DAY_TODAY, SIM_CREW, store } from "../../data/db";

const KIND_LABEL: Record<WorkoutKind, string> = { resistive: "Resistive", aerobic: "Aerobic" };

/** Decide which row a submission writes: the open planned row, a missing planned row, or a new extra session. */
function targetFor(kind: WorkoutKind, today: Workout[]): { row?: Workout; plannedMinutes?: number; label: string } {
  const plannedRow = today.find((w) => w.kind === kind && w.plannedMinutes !== undefined);
  if (plannedRow && !plannedRow.completed) return { row: plannedRow, label: `Updates today's planned ${kind} session` };
  const plan = DEMO_WORKOUT_PLAN.find((p) => p.kind === kind);
  if (!plannedRow && plan) return { plannedMinutes: plan.plannedMinutes, label: `Logs today's planned ${kind} session` };
  return { label: `Adds an extra ${kind} session` };
}

export function LogWorkoutForm({ today }: { today: Workout[] }) {
  const [kind, setKind] = useState<WorkoutKind>("aerobic");
  const [minutes, setMinutes] = useState("30");
  const [completed, setCompleted] = useState(true);
  const [device, setDevice] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<{ kind: WorkoutKind; chest: boolean }>();

  const target = targetFor(kind, today);

  function pickKind(k: WorkoutKind) {
    setKind(k);
    setDevice("");
    const t = targetFor(k, today);
    setMinutes(String(t.row?.plannedMinutes ?? t.plannedMinutes ?? 30));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const mins = Number(minutes);
    if (minutes.trim() === "" || !Number.isFinite(mins) || mins < 0) {
      setError("Enter minutes as a number, 0 or more.");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const now = new Date().toISOString();
      const fields = {
        minutes: mins,
        completed,
        notes: notes.trim() || undefined,
        device: device || undefined,
      };
      if (target.row) {
        await store.saveWorkout({ ...target.row, ...fields });
      } else {
        await store.saveWorkout({
          id: target.plannedMinutes !== undefined ? `wo-${MISSION_DAY_TODAY}-${kind}` : `wk-${crypto.randomUUID()}`,
          crewId: SIM_CREW.id,
          at: now,
          kind,
          plannedMinutes: target.plannedMinutes,
          ...fields,
        });
      }
      // Keep the daily checklist in step with the tracker.
      if (completed) {
        const item = (await store.listChecklist(String(MISSION_DAY_TODAY))).find(
          (i) => i.kind === "exercise" && i.id.endsWith(`-${kind}`),
        );
        if (item && !item.doneAt) await store.saveChecklistItem({ ...item, doneAt: now });
      }
      setSaved({ kind, chest: kind === "resistive" && /chest/i.test(notes) });
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="log-form" onSubmit={(e) => void submit(e)}>
      <h2>Log a session</h2>
      <div className="seg" role="radiogroup" aria-label="Session kind">
        {(["resistive", "aerobic"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            className={kind === k ? "active" : ""}
            onClick={() => pickKind(k)}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <p className="muted small">{target.label}.</p>
      <div className="form-grid">
        <label>
          Minutes
          <input type="number" min={0} step={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </label>
        <label>
          Device <span className="muted">(optional)</span>
          <select value={device} onChange={(e) => setDevice(e.target.value)}>
            <option value="">Not recorded</option>
            {EXERCISE_DEVICES[kind].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="wide">
          Notes <span className="muted">(optional)</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <label className="inline">
          <input type="checkbox" checked={completed} onChange={(e) => setCompleted(e.target.checked)} /> Completed
        </label>
      </div>
      <div className="row-actions">
        <button type="submit" className="primary" disabled={busy}>
          Save session
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {saved ? (
        <p className="muted small" role="status">
          Saved {saved.kind} session.
          {saved.chest ? (
            <>
              {" "}
              <strong className="hint">Chest symptoms noted. </strong>
              <Link to="/emergency">Open the emergency flow</Link> if they persist.
            </>
          ) : null}
        </p>
      ) : null}
    </form>
  );
}
