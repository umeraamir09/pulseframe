import type { Workout, WorkoutKind } from "../../contracts";
import { EXERCISE_SOURCES, FIRST_SEED_DAY, MISSION_DAY_TODAY, missionDayLabel, missionDayOf } from "../../data/db";
import { Icon } from "../../ui/Icon";

interface DayCell {
  md: number;
  kinds: Record<WorkoutKind, { planned: number; done: number; notes?: string } | undefined>;
}

function cells(rows: Workout[]): DayCell[] {
  const out: DayCell[] = [];
  for (let md = FIRST_SEED_DAY; md <= MISSION_DAY_TODAY; md++) {
    const day: DayCell = { md, kinds: { resistive: undefined, aerobic: undefined } };
    for (const w of rows.filter((r) => missionDayOf(r.at) === md)) {
      const cur = day.kinds[w.kind] ?? { planned: 0, done: 0 };
      cur.planned += w.plannedMinutes ?? 0;
      if (w.completed) cur.done += w.minutes;
      if (w.notes) cur.notes = w.notes;
      day.kinds[w.kind] = cur;
    }
    out.push(day);
  }
  return out;
}

const KIND_LABEL: Record<WorkoutKind, string> = { resistive: "Resistive", aerobic: "Aerobic" };

/** Planned vs completed by mission day: a full colored bar is a session done, grey is planned and not done. */
export function WeekChart({ rows }: { rows: Workout[] }) {
  const days = cells(rows);
  const max = Math.max(1, ...days.flatMap((d) => Object.values(d.kinds).map((k) => Math.max(k?.planned ?? 0, k?.done ?? 0))));
  const noted = days.find((d) => d.kinds.resistive?.notes && /chest/i.test(d.kinds.resistive.notes));

  return (
    <section className="card" aria-labelledby="week-title">
      <div className="card-head">
        <div className="titles">
          <p className="overline">This week</p>
          <h2 id="week-title" className="h2">
            Planned vs completed
          </h2>
        </div>
        <div className="legend" aria-hidden="true">
          <span>
            <i style={{ background: "var(--surface2)" }} />
            Planned
          </span>
          <span>
            <i style={{ background: "var(--accent)" }} />
            Resistive
          </span>
          <span>
            <i style={{ background: "var(--normal)" }} />
            Aerobic
          </span>
        </div>
      </div>

      <div className="week-bars" aria-hidden="true">
        {noted ? (
          <span className="chart-pill" style={{ position: "absolute", top: 0, right: 0 }}>
            <span className="dot act" /> Chest tightness after session
          </span>
        ) : null}
        {days.map((d) => (
          <div key={d.md} className="week-day">
            {(["resistive", "aerobic"] as const).map((k) => {
              const v = d.kinds[k];
              if (!v) return <span key={k} className="b" style={{ height: "6%", opacity: 0.5 }} />;
              const done = v.done > 0;
              const h = Math.max(12, ((done ? Math.max(v.done, v.planned) : v.planned) / max) * 100);
              return <span key={k} className={`b${done ? ` ${k}` : ""}`} style={{ height: `${h}%` }} />;
            })}
          </div>
        ))}
      </div>
      <div className="week-labels" aria-hidden="true">
        {days.map((d) => (
          <span key={d.md}>{missionDayLabel(d.md)}</span>
        ))}
      </div>

      <p className="row muted small" style={{ marginTop: 14 }}>
        <Icon name="info" size={16} /> Full bar = session done. Grey = planned, not done. Height is minutes.
      </p>

      <details style={{ marginTop: 10 }}>
        <summary className="small" style={{ color: "var(--accent)", cursor: "pointer" }}>
          Show as table
        </summary>
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Day</th>
                {(["resistive", "aerobic"] as const).map((k) => (
                  <th key={k}>{KIND_LABEL[k]} done / planned</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.md}>
                  <td>{missionDayLabel(d.md)}</td>
                  {(["resistive", "aerobic"] as const).map((k) => (
                    <td key={k}>{d.kinds[k] ? `${d.kinds[k]!.done} / ${d.kinds[k]!.planned} min` : "–"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small" style={{ marginTop: 10 }}>
          Why exercise:{" "}
          {EXERCISE_SOURCES.map((s, i) => (
            <span key={s.url}>
              {i ? " · " : ""}
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title}
              </a>
            </span>
          ))}
        </p>
      </details>
    </section>
  );
}
