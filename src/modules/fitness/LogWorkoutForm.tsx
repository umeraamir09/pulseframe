import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { Workout, WorkoutKind } from "../../contracts";
import { DEMO_WORKOUT_PLAN, MISSION_DAY_TODAY, SIM_CREW, missionDayLabel, store, useLive } from "../../data/db";
import { Scale5, Segmented, UnitInput } from "../../ui/controls";
import { Icon } from "../../ui/Icon";

/** Decide which row a submission writes: the open planned row, a missing planned row, or a new extra session. */
function targetFor(kind: WorkoutKind, today: Workout[]): { row?: Workout; plannedMinutes?: number; label: string } {
  const plannedRow = today.find((w) => w.kind === kind && w.plannedMinutes !== undefined);
  if (plannedRow && !plannedRow.completed) return { row: plannedRow, label: `Updates today's planned ${kind} session` };
  const plan = DEMO_WORKOUT_PLAN.find((p) => p.kind === kind);
  if (!plannedRow && plan) return { plannedMinutes: plan.plannedMinutes, label: `Logs today's planned ${kind} session` };
  return { label: `Adds an extra ${kind} session` };
}

export function LogWorkoutForm({ today }: { today: Workout[] }) {
  const [kind, setKind] = useState<WorkoutKind>("resistive");
  const [minutes, setMinutes] = useState(() => String(targetFor("resistive", today).plannedMinutes ?? 45));
  const [effort, setEffort] = useState(3);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<{ kind: WorkoutKind; chest: boolean }>();
  const { data: openCase } = useLive(() => store.getOpenCase(SIM_CREW.id), []);

  const target = targetFor(kind, today);

  function pickKind(k: WorkoutKind) {
    setKind(k);
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
      const note = [`Effort ${effort} of 5`, notes.trim()].filter(Boolean).join(". ");
      const fields = { minutes: mins, completed: true, notes: note };
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
      const item = (await store.listChecklist(String(MISSION_DAY_TODAY))).find(
        (i) => i.kind === "exercise" && i.id.endsWith(`-${kind}`),
      );
      if (item && !item.doneAt) await store.saveChecklistItem({ ...item, doneAt: now, value: mins });
      setSaved({ kind, chest: kind === "resistive" && /chest/i.test(notes) });
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card log-card" aria-labelledby="log-title">
      <div className="titles">
        <p className="overline">Log</p>
        <h2 id="log-title" className="h2">
          Log a session
        </h2>
      </div>
      <form onSubmit={(e) => void submit(e)}>
        <div className="field">
          <span className="field-label">Type</span>
          <Segmented
            label="Session type"
            value={kind}
            onChange={pickKind}
            className="on-surface2"
            options={[
              {
                value: "resistive",
                label: (
                  <>
                    <Icon name="dumbbell" size={18} /> Resistive
                  </>
                ),
              },
              {
                value: "aerobic",
                label: (
                  <>
                    <Icon name="heart" size={18} /> Aerobic
                  </>
                ),
              },
            ]}
          />
          <span className="faint small">{target.label}.</span>
        </div>

        <div className="field">
          <span className="field-label">Duration</span>
          <UnitInput unit="min" min={0} step={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-label="Duration in minutes" />
        </div>

        <div className="field">
          <span className="field-label">Effort, 1 to 5</span>
          <Scale5 label="Effort" value={effort} onChange={setEffort} low="Easy" high="Hard" />
        </div>

        <label className="field">
          <span className="field-label">Notes, optional</span>
          <textarea className="textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        {openCase ? (
          <>
            <p className="note act">
              <Icon name="siren" size={16} /> {missionDayLabel(MISSION_DAY_TODAY)} session linked to open case
            </p>
            <p className="note ink">
              <Icon name="alert" size={16} /> No exercise until surgeon clears
            </p>
          </>
        ) : null}

        {error ? <p className="error">{error}</p> : null}
        {saved ? (
          <p className="note normal" role="status">
            <Icon name="check" size={16} />
            <span>
              Saved {saved.kind} session.
              {saved.chest ? (
                <>
                  {" "}
                  Chest symptoms noted. <Link to="/emergency">Open the emergency flow</Link> if they persist.
                </>
              ) : null}
            </span>
          </p>
        ) : null}

        <span className="spacer" />
        <button type="submit" className="btn primary block" disabled={busy}>
          <Icon name="plus" size={18} /> Log session
        </button>
      </form>
    </section>
  );
}
