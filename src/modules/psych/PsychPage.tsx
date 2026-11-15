import { HRP_HAZARDS_URL } from "../../contracts";
import {
  FIRST_SEED_DAY,
  SIM_CREW,
  missionDayLabel,
  missionDayOf,
  missionDayStart,
  store,
  useLive,
} from "../../data/db";
import { HazardChip } from "../../ui/HazardChip";
import { MetricTrend } from "../../ui/MetricTrend";
import { CheckInForm } from "./CheckInForm";

const OCHMO_BRIEF = "https://www.nasa.gov/wp-content/uploads/2023/03/behavioral-health-technical-brief-ochmo.pdf";

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function PsychPage() {
  const { data: checks } = useLive(
    () => store.listPsych(SIM_CREW.id, missionDayStart(FIRST_SEED_DAY).toISOString()),
    [],
  );
  const last7 = (checks ?? []).slice(-7).reverse();

  return (
    <section className="panel psych">
      <header className="page-head">
        <div>
          <h1>Psychology checkup</h1>
          <p className="muted">{SIM_CREW.displayName} (simulated)</p>
        </div>
        <HazardChip id="isolation" />
      </header>

      <p className="intro">A simple daily self-report. This is not WinSCAT and not a clinical screen.</p>

      <CheckInForm />

      <section className="dash-section">
        <div className="section-head">
          <h2>Last 7 days</h2>
        </div>
        <div className="trend-grid two">
          <MetricTrend crewId={SIM_CREW.id} metricKey="moodScore" />
          <MetricTrend crewId={SIM_CREW.id} metricKey="stressScore" />
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Time</th>
                <th>Mood</th>
                <th>Stress</th>
                <th>Team strain</th>
                <th>Sleep quality</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {last7.map((c) => (
                <tr key={c.id}>
                  <td>{missionDayLabel(missionDayOf(c.at))}</td>
                  <td>{timeOf(c.at)}</td>
                  <td>{c.mood}</td>
                  <td>{c.stress}</td>
                  <td>{c.teamStrain}</td>
                  <td>{c.sleepQuality}</td>
                  <td className="muted">{c.note ? "shared" : "–"}</td>
                </tr>
              ))}
              {checks && !last7.length ? (
                <tr>
                  <td colSpan={7} className="muted">
                    No check-ins yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="muted small">Scales: mood and sleep quality 1 low to 5 good; stress and team strain 1 low to 5 high.</p>
      </section>

      <footer className="why">
        <h2>Background</h2>
        <p>
          Isolation and confinement are one of NASA's five hazards of human spaceflight. NASA's behavioral health brief
          describes how crews are monitored; it mentions WinSCAT, which Pulseframe does not include.
        </p>
        <ul>
          <li>
            <a href={OCHMO_BRIEF} target="_blank" rel="noreferrer">
              NASA OCHMO: Behavioral health technical brief (PDF)
            </a>
          </li>
          <li>
            <a href={HRP_HAZARDS_URL} target="_blank" rel="noreferrer">
              NASA HRP: 5 hazards of human spaceflight
            </a>
          </li>
        </ul>
      </footer>
    </section>
  );
}
