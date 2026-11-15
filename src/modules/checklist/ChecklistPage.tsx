import { useState } from "react";
import type { ChecklistItem } from "../../contracts";
import { FIRST_SEED_DAY, MISSION_DAY_TODAY, SIM_CREW, missionDayLabel, store, useLive } from "../../data/db";
import { HazardChip } from "../../ui/HazardChip";
import { ChecklistRow } from "./ChecklistRow";

const GROUPS: { kind: ChecklistItem["kind"]; title: string }[] = [
  { kind: "meds", title: "Medications" },
  { kind: "vitals", title: "Vitals" },
  { kind: "exercise", title: "Exercise countermeasures" },
  { kind: "radiation", title: "Radiation" },
  { kind: "psych", title: "Psychology" },
  { kind: "other", title: "Other" },
];

const DAYS = Array.from({ length: MISSION_DAY_TODAY - FIRST_SEED_DAY + 1 }, (_, i) => FIRST_SEED_DAY + i);

export function ChecklistPage() {
  const [md, setMd] = useState(MISSION_DAY_TODAY);
  const [editPast, setEditPast] = useState(false);
  const { data: items, loading, error } = useLive(() => store.listChecklist(String(md)), [md]);
  const { data: inventory } = useLive(() => store.listInventory(), []);

  const isPast = md < MISSION_DAY_TODAY;
  const readOnly = isPast && !editPast;
  const required = (items ?? []).filter((i) => i.required);
  const requiredDone = required.filter((i) => i.doneAt).length;
  const pct = required.length ? Math.round((requiredDone / required.length) * 100) : 0;

  return (
    <section className="panel checklist">
      <header className="page-head">
        <div>
          <h1>Daily checklist</h1>
          <p className="muted">
            {SIM_CREW.displayName} (simulated) · {missionDayLabel(md)}
            {md === MISSION_DAY_TODAY ? " · today" : ""}
          </p>
        </div>
        <HazardChip id="environment" />
      </header>

      <div className="day-picker" role="tablist" aria-label="Mission day">
        {DAYS.map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={d === md}
            className={d === md ? "active" : ""}
            onClick={() => {
              setMd(d);
              setEditPast(false);
            }}
          >
            {missionDayLabel(d)}
          </button>
        ))}
      </div>

      <div className="progress-wrap">
        <div className="progress-label">
          <strong>
            Required done: {requiredDone} of {required.length}
          </strong>
          {isPast ? (
            <label className="edit-past">
              <input type="checkbox" checked={editPast} onChange={(e) => setEditPast(e.target.checked)} /> Edit past
              day
            </label>
          ) : null}
        </div>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>

      {error ? <p className="error">Could not load the checklist: {error.message}</p> : null}
      {loading && !items ? <p className="muted">Loading…</p> : null}
      {items && items.length === 0 ? (
        <p className="muted">No checklist for this day yet.</p>
      ) : null}

      {GROUPS.map(({ kind, title }) => {
        const rows = (items ?? []).filter((i) => i.kind === kind);
        if (!rows.length) return null;
        const doneCount = rows.filter((r) => r.doneAt).length;
        return (
          <section key={kind} className="check-group">
            <h2>
              {title}{" "}
              <span className="muted">
                {doneCount}/{rows.length}
              </span>
            </h2>
            {kind === "meds" ? (
              <p className="muted small">
                Pulseframe records that a medication was taken. It never suggests a dose: follow the flight surgeon.
              </p>
            ) : null}
            <ul>
              {rows.map((item) => (
                <ChecklistRow key={item.id} item={item} readOnly={readOnly} inventory={inventory ?? []} />
              ))}
            </ul>
          </section>
        );
      })}

      <p className="muted small footnote">
        Items are drawn from public NASA material on ISS crew routines (linked per item). Times and exercise minutes are
        demonstration values, not a NASA prescription.
      </p>
    </section>
  );
}
