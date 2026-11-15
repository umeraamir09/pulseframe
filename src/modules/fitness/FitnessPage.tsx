import {
  FIRST_SEED_DAY,
  MISSION_DAY_TODAY,
  SIM_CREW,
  missionDayLabel,
  missionDayOf,
  missionDayStart,
  store,
  useLive,
} from "../../data/db";
import { Progress } from "../../ui/controls";
import { HazardChip } from "../../ui/HazardChip";
import { Icon } from "../../ui/Icon";
import { usePageMeta } from "../../ui/pageMeta";
import { adherence } from "./fitnessStats";
import { LogWorkoutForm } from "./LogWorkoutForm";
import { WeekChart } from "./WeekChart";

function Ring({ done, total }: { done: number; total: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  return (
    <svg className="ring" viewBox="0 0 128 128" aria-hidden="true">
      <circle cx="64" cy="64" r={r} fill="none" stroke="var(--surface2)" strokeWidth="12" />
      <circle
        cx="64"
        cy="64"
        r={r}
        fill="none"
        stroke="var(--normal)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`}
        transform="rotate(-90 64 64)"
      />
    </svg>
  );
}

export function FitnessPage() {
  usePageMeta(
    "Fitness countermeasures",
    `Planned vs completed, ${missionDayLabel(FIRST_SEED_DAY)} to ${missionDayLabel(MISSION_DAY_TODAY)}`,
  );
  const { data, loading, error } = useLive(
    () => store.listWorkouts(SIM_CREW.id, missionDayStart(FIRST_SEED_DAY).toISOString()),
    [],
  );
  const rows = data ?? [];
  const week = rows.filter((w) => missionDayOf(w.at) <= MISSION_DAY_TODAY);
  const today = rows.filter((w) => missionDayOf(w.at) === MISSION_DAY_TODAY);
  const adh = adherence(week);
  const byKind = (["resistive", "aerobic"] as const).map((k) => {
    const planned = week.filter((w) => w.kind === k && w.plannedMinutes !== undefined);
    return { kind: k, done: planned.filter((w) => w.completed).length, total: planned.length };
  });

  return (
    <div className="fit-grid">
      <div className="fit-main">
        {error ? <p className="error">Could not load workouts: {error.message}</p> : null}
        {loading && !data ? <p className="muted">Loading…</p> : null}
        <div className="fit-top">
          <section className="card ring-card" aria-label="Adherence">
            <Ring done={adh.completedSessions} total={adh.plannedSessions} />
            <div className="stack" style={{ gap: 6 }}>
              <span className="muted" style={{ fontWeight: 500 }}>
                Adherence
              </span>
              <div className="big-value">
                <span className="numeral-xl" style={{ fontSize: 64 }}>
                  {adh.completedSessions}
                </span>
                <span className="unit" style={{ fontSize: 20 }}>
                  of {adh.plannedSessions}
                </span>
              </div>
              <span className="tag normal" style={{ alignSelf: "flex-start" }}>
                Sessions done this week
              </span>
              <span className="faint small">
                {adh.completedMinutes} of {adh.plannedMinutes} planned min
                {adh.extraSessions ? ` · ${adh.extraSessions} extra` : ""}. Plan is demonstration only.
              </span>
            </div>
          </section>

          <section className="card bytype" aria-label="By type">
            <span className="muted" style={{ fontWeight: 500 }}>
              By type
            </span>
            {byKind.map((k) => (
              <div key={k.kind}>
                <div className="top">
                  <span className="row">
                    <Icon name={k.kind === "resistive" ? "dumbbell" : "heart"} size={18} />
                    {k.kind === "resistive" ? "Resistive" : "Aerobic"}
                  </span>
                  <span>
                    {k.done} of {k.total}
                  </span>
                </div>
                <Progress
                  pct={k.total ? (k.done / k.total) * 100 : 0}
                  tone={k.kind === "aerobic" ? "normal" : undefined}
                  label={`${k.kind} sessions`}
                />
              </div>
            ))}
            <div>
              <HazardChip id="gravity" />
            </div>
          </section>
        </div>

        <WeekChart rows={week} />
      </div>

      <LogWorkoutForm today={today} />
    </div>
  );
}
