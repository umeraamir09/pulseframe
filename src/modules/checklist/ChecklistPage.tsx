import { useState } from "react";
import type { ChecklistItem } from "../../contracts";
import { FIRST_SEED_DAY, MISSION_DAY_TODAY, missionDayLabel, store, useLive } from "../../data/db";
import { Icon, type IconName } from "../../ui/Icon";
import { usePageMeta } from "../../ui/pageMeta";
import { ChecklistRow } from "./ChecklistRow";

type Kind = ChecklistItem["kind"];

const GROUPS: { kind: Kind; title: string; short: string; icon: IconName }[] = [
  { kind: "meds", title: "Meds", short: "Meds", icon: "pill" },
  { kind: "vitals", title: "Vitals", short: "Vitals", icon: "heart" },
  { kind: "exercise", title: "Exercise", short: "Exercise", icon: "dumbbell" },
  { kind: "radiation", title: "Radiation", short: "Radiation", icon: "radiation" },
  { kind: "psych", title: "Psych", short: "Psych", icon: "smile" },
  { kind: "other", title: "Other", short: "Other", icon: "checklist" },
];

/** Two columns as in the design: meds, vitals, radiation on the left; exercise, psych, other on the right. */
const COLUMNS: Kind[][] = [
  ["meds", "vitals", "radiation"],
  ["exercise", "psych", "other"],
];

const DAYS = Array.from({ length: MISSION_DAY_TODAY - FIRST_SEED_DAY + 1 }, (_, i) => FIRST_SEED_DAY + i);

export function ChecklistPage() {
  const [md, setMd] = useState(MISSION_DAY_TODAY);
  const [editPast, setEditPast] = useState(false);
  usePageMeta("Daily checklist", `${missionDayLabel(md)} · grouped by type`);
  const { data: items, loading, error } = useLive(() => store.listChecklist(String(md)), [md]);
  const { data: inventory } = useLive(() => store.listInventory(), []);

  const isPast = md < MISSION_DAY_TODAY;
  const readOnly = isPast && !editPast;
  const rows = items ?? [];
  const done = rows.filter((i) => i.doneAt).length;
  const sources = [...new Set(rows.map((r) => r.sourceUrl).filter((u): u is string => Boolean(u)))];

  return (
    <div className="stack" style={{ gap: 20 }}>
      <section className="card check-summary" aria-label="Progress">
        <div className="big">
          <span className="numeral-xl" style={{ fontSize: 64 }}>
            {done}
          </span>
          <span className="unit" style={{ fontSize: 20 }}>
            of {rows.length}
          </span>
        </div>
        <div>
          <span className="muted" style={{ fontWeight: 500 }}>
            {isPast ? `Done on ${missionDayLabel(md)}` : "Done today"}
          </span>
          <div className="seg-progress" role="progressbar" aria-valuemin={0} aria-valuemax={rows.length} aria-valuenow={done}>
            {rows.map((r, i) => (
              <span key={r.id} className={i < done ? "on" : undefined} />
            ))}
          </div>
        </div>
        <div className="group-counters">
          {GROUPS.map((g) => {
            const gr = rows.filter((r) => r.kind === g.kind);
            if (!gr.length) return null;
            return (
              <span key={g.kind} className="group-counter">
                <b>
                  {gr.filter((r) => r.doneAt).length}/{gr.length}
                </b>
                <span>{g.short}</span>
              </span>
            );
          })}
        </div>
        <div className="day-select">
          <label className="sr" htmlFor="md-pick">
            Mission day
          </label>
          <select
            id="md-pick"
            className="select"
            value={md}
            onChange={(e) => {
              setMd(Number(e.target.value));
              setEditPast(false);
            }}
          >
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {missionDayLabel(d)}
                {d === MISSION_DAY_TODAY ? " (today)" : ""}
              </option>
            ))}
          </select>
          {isPast ? (
            <button type="button" className={`btn xs ${editPast ? "dark" : "secondary"}`} onClick={() => setEditPast((v) => !v)}>
              <Icon name="edit" size={14} /> {editPast ? "Editing" : "Edit day"}
            </button>
          ) : null}
        </div>
      </section>

      {error ? <p className="error">Could not load the checklist: {error.message}</p> : null}
      {loading && !items ? <p className="muted">Loading…</p> : null}
      {items && items.length === 0 ? <p className="muted">No checklist for this day yet.</p> : null}

      <div className="check-cols">
        {COLUMNS.map((col, ci) => (
          <div key={ci} className="check-col">
            {col.map((kind) => {
              const g = GROUPS.find((x) => x.kind === kind)!;
              const gr = rows.filter((i) => i.kind === kind);
              if (!gr.length) return null;
              return (
                <section key={kind} className="card check-card" aria-labelledby={`grp-${kind}`}>
                  <div className="card-head">
                    <span className="icon-badge sm accent sq">
                      <Icon name={g.icon} size={18} />
                    </span>
                    <h2 id={`grp-${kind}`} className="h3">
                      {g.title}
                    </h2>
                    <span className="muted small">
                      {gr.filter((r) => r.doneAt).length} of {gr.length}
                    </span>
                  </div>
                  {gr.map((item) => (
                    <ChecklistRow key={item.id} item={item} readOnly={readOnly} inventory={inventory ?? []} />
                  ))}
                  {kind === "meds" ? (
                    <p className="note watch">
                      <Icon name="shield" size={16} /> Pulseframe does not suggest doses.
                    </p>
                  ) : null}
                </section>
              );
            })}
          </div>
        ))}
      </div>

      {sources.length ? (
        <p className="muted small">
          Items are drawn from public NASA material on ISS crew routines:{" "}
          {sources.map((u, i) => (
            <span key={u}>
              {i ? ", " : ""}
              <a href={u} target="_blank" rel="noreferrer">
                source {i + 1}
              </a>
            </span>
          ))}
          . Times and exercise minutes are demonstration values, not a NASA prescription.
        </p>
      ) : null}
    </div>
  );
}
