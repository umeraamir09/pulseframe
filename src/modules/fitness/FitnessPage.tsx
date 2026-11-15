import { HRP_HAZARDS, HRP_HAZARDS_URL, type Workout } from "../../contracts";
import {
  DEMO_WORKOUT_PLAN,
  EXERCISE_SOURCES,
  FIRST_SEED_DAY,
  MISSION_DAY_TODAY,
  SIM_CREW,
  missionDayLabel,
  missionDayOf,
  missionDayStart,
  store,
  useLive,
} from "../../data/db";
import { adherence, weekBars } from "./fitnessStats";
import { LogWorkoutForm } from "./LogWorkoutForm";
import { WeekChart } from "./WeekChart";

const HAZARD = HRP_HAZARDS.find((h) => h.id === "gravity")!;

function hhmm(hour: number): string {
  return `${String(Math.floor(hour)).padStart(2, "0")}:${String(Math.round((hour % 1) * 60)).padStart(2, "0")}`;
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function SessionRow({ w, extra }: { w: Workout; extra?: boolean }) {
  return (
    <li className={`session${w.completed ? " done" : ""}`}>
      <span className={`kind-dot ${w.kind}`} aria-hidden="true" />
      <div className="session-text">
        <strong>
          {w.kind === "resistive" ? "Resistive" : "Aerobic"}
          {extra ? " (extra)" : ""}
        </strong>
        <span className="muted small">
          {timeOf(w.at)}
          {w.device ? ` · ${w.device}` : ""}
          {w.notes ? ` · ${w.notes}` : ""}
        </span>
      </div>
      <span className="session-status">
        {w.completed ? (
          <>
            Done · {w.minutes}
            {w.plannedMinutes !== undefined ? ` of ${w.plannedMinutes}` : ""} min
          </>
        ) : (
          <>Not done{w.plannedMinutes !== undefined ? ` · ${w.plannedMinutes} min planned` : ""}</>
        )}
      </span>
    </li>
  );
}

export function FitnessPage() {
  const { data, loading, error } = useLive(
    () => store.listWorkouts(SIM_CREW.id, missionDayStart(FIRST_SEED_DAY).toISOString()),
    [],
  );
  const rows = data ?? [];
  const today = rows.filter((w) => missionDayOf(w.at) === MISSION_DAY_TODAY);
  const week = rows.filter((w) => missionDayOf(w.at) <= MISSION_DAY_TODAY);
  const adh = adherence(week);
  const bars = weekBars(week);
  const notYetLogged = DEMO_WORKOUT_PLAN.filter(
    (p) => !today.some((w) => w.kind === p.kind && w.plannedMinutes !== undefined),
  );

  return (
    <section className="panel fitness">
      <header className="page-head">
        <div>
          <h1>Fitness countermeasures</h1>
          <p className="muted">
            {SIM_CREW.displayName} (simulated) · {missionDayLabel(FIRST_SEED_DAY)} to {missionDayLabel(MISSION_DAY_TODAY)}
          </p>
        </div>
        {/* Swap for Dev A's <HazardChip id="gravity" /> when src/ui/HazardChip lands (issue 1). */}
        <a className="hazard-chip" href={HRP_HAZARDS_URL} target="_blank" rel="noreferrer">
          NASA HRP hazard: {HAZARD.label}
        </a>
      </header>

      {error ? <p className="error">Could not load workouts: {error.message}</p> : null}
      {loading && !data ? <p className="muted">Loading…</p> : null}

      <div className="fit-top">
        <div className="tile adherence">
          <span className="muted small">Adherence this week</span>
          <span className="hero">{adh.pct}%</span>
          <span>
            {adh.completedSessions} of {adh.plannedSessions} planned sessions
          </span>
          <span className="muted small">
            {adh.completedMinutes} of {adh.plannedMinutes} planned minutes
            {adh.extraSessions ? ` · ${adh.extraSessions} extra session${adh.extraSessions > 1 ? "s" : ""}` : ""}
          </span>
          <span className="muted small caption">Plan values are demonstration only.</span>
        </div>

        <div className="tile today">
          <h2>Today · {missionDayLabel(MISSION_DAY_TODAY)}</h2>
          <ul className="sessions">
            {today.map((w) => (
              <SessionRow key={w.id} w={w} extra={w.plannedMinutes === undefined} />
            ))}
            {notYetLogged.map((p) => (
              <li key={p.kind} className="session pending">
                <span className={`kind-dot ${p.kind}`} aria-hidden="true" />
                <div className="session-text">
                  <strong>{p.kind === "resistive" ? "Resistive" : "Aerobic"}</strong>
                  <span className="muted small">Scheduled {hhmm(p.hour)}</span>
                </div>
                <span className="session-status">Planned · {p.plannedMinutes} min</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <WeekChart data={bars} />

      <LogWorkoutForm today={today} />

      <aside className="why">
        <h2>Why this matters</h2>
        <p>Exercise is the main countermeasure the team modeled against changes from altered gravity.</p>
        <ul>
          {EXERCISE_SOURCES.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </aside>
    </section>
  );
}
