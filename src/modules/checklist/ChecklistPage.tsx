import { useState } from "react";
import { Link } from "react-router-dom";
import type { ChecklistItem } from "../../contracts";
import { FIRST_SEED_DAY, MISSION_DAY_TODAY, missionDayLabel, store, useLive } from "../../data/db";
import { HazardChip } from "../../ui/HazardChip";
import checklistIcon from "../../assets/icons/checklist/checklist.svg";
import dumbbellIcon from "../../assets/icons/checklist/dumbbell.svg";
import heartIcon from "../../assets/icons/checklist/heart.svg";
import pillIcon from "../../assets/icons/checklist/pill.svg";
import radiationIcon from "../../assets/icons/checklist/radiation.svg";
import shieldWatchIcon from "../../assets/icons/checklist/shield-watch.svg";
import smileIcon from "../../assets/icons/checklist/smile.svg";
import { ChecklistRow } from "./ChecklistRow";

type Kind = ChecklistItem["kind"];

const GROUP: Record<Kind, { title: string; short: string; icon: string; to?: string }> = {
  meds: { title: "Meds", short: "Meds", icon: pillIcon },
  vitals: { title: "Vitals", short: "Vitals", icon: heartIcon },
  exercise: { title: "Exercise", short: "Exercise", icon: dumbbellIcon, to: "/fitness" },
  radiation: { title: "Radiation", short: "Radiation", icon: radiationIcon, to: "/radiation" },
  psych: { title: "Psych", short: "Psych", icon: smileIcon, to: "/psych" },
  other: { title: "Other", short: "Other", icon: checklistIcon },
};

/** Summary tile order, and the two card columns from the design. */
const ORDER: Kind[] = ["meds", "vitals", "exercise", "radiation", "psych", "other"];
const COLUMNS: Kind[][] = [
  ["meds", "vitals", "radiation"],
  ["exercise", "psych", "other"],
];

const DAYS = Array.from({ length: MISSION_DAY_TODAY - FIRST_SEED_DAY + 1 }, (_, i) => FIRST_SEED_DAY + i);

export function ChecklistPage() {
  const [md, setMd] = useState(MISSION_DAY_TODAY);
  const [editPast, setEditPast] = useState(false);
  const { data: items, loading, error } = useLive(() => store.listChecklist(String(md)), [md]);
  const { data: inventory } = useLive(() => store.listInventory(), []);

  const all = items ?? [];
  const isPast = md < MISSION_DAY_TODAY;
  const readOnly = isPast && !editPast;
  const required = all.filter((i) => i.required);
  const requiredDone = required.filter((i) => i.doneAt).length;
  const byKind = (k: Kind) => all.filter((i) => i.kind === k);

  return (
    <section className="cl">
      <header className="cl-head">
        <div>
          <h1>Daily checklist</h1>
          <p>
            {missionDayLabel(md)}
            {md === MISSION_DAY_TODAY ? " (today)" : ""} · grouped by type
          </p>
        </div>
        <div className="cl-head-tools">
          <div className="cl-days" role="tablist" aria-label="Mission day">
            {DAYS.map((d) => (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={d === md}
                className={d === md ? "is-active" : ""}
                onClick={() => {
                  setMd(d);
                  setEditPast(false);
                }}
              >
                {d}
              </button>
            ))}
          </div>
          <HazardChip id="environment" />
        </div>
      </header>

      <div className="cl-card cl-progress">
        <p className="cl-count">
          <span className="cl-count-big">{requiredDone}</span>
          <span className="cl-count-of">of {required.length}</span>
        </p>
        <div className="cl-progress-mid">
          <p className="cl-progress-label">
            Required done{md === MISSION_DAY_TODAY ? " today" : ""}
            {isPast ? (
              <label className="cl-edit-past">
                <input type="checkbox" checked={editPast} onChange={(e) => setEditPast(e.target.checked)} /> Edit past
                day
              </label>
            ) : null}
          </p>
          <div
            className="cl-strip"
            role="progressbar"
            aria-label="Required items done"
            aria-valuemin={0}
            aria-valuemax={required.length}
            aria-valuenow={requiredDone}
          >
            {required.map((_, i) => (
              <span key={i} className={i < requiredDone ? "on" : ""} />
            ))}
          </div>
        </div>
        <ul className="cl-tiles" aria-label="Done by type">
          {ORDER.map((k) => {
            const rows = byKind(k);
            if (!rows.length) return null;
            return (
              <li key={k}>
                <strong>
                  {rows.filter((r) => r.doneAt).length}/{rows.length}
                </strong>
                <span>{GROUP[k].short}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {error ? <p className="cl-error">Could not load the checklist: {error.message}</p> : null}
      {loading && !items ? <p className="muted">Loading…</p> : null}
      {items && items.length === 0 ? <p className="muted">No checklist for this day yet.</p> : null}

      <div className="cl-groups">
        {COLUMNS.map((col, ci) => (
          <div key={ci} className="cl-col">
            {col.map((k) => {
              const rows = byKind(k);
              if (!rows.length) return null;
              const g = GROUP[k];
              return (
                <section key={k} className="cl-card cl-group" aria-labelledby={`cl-group-${k}`}>
                  <div className="cl-group-head">
                    <span className="cl-group-icon">
                      <img src={g.icon} alt="" width={18} height={18} />
                    </span>
                    <h2 id={`cl-group-${k}`}>{g.to ? <Link to={g.to}>{g.title}</Link> : g.title}</h2>
                    <span className="cl-group-count">
                      {rows.filter((r) => r.doneAt).length} of {rows.length}
                    </span>
                  </div>
                  <ul className="cl-items">
                    {rows.map((item) => (
                      <ChecklistRow key={item.id} item={item} readOnly={readOnly} inventory={inventory ?? []} />
                    ))}
                  </ul>
                  {k === "meds" ? (
                    <p className="cl-dose-note">
                      <img src={shieldWatchIcon} alt="" width={14} height={14} />
                      Pulseframe does not suggest doses.
                    </p>
                  ) : null}
                </section>
              );
            })}
          </div>
        ))}
      </div>

      <p className="cl-footnote">
        Items are drawn from public NASA material on ISS crew routines (hover the info icon for the source). Times and
        exercise minutes are demonstration values, not a NASA prescription.
      </p>
    </section>
  );
}
