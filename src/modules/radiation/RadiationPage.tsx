import { HRP_HAZARDS, HRP_HAZARDS_URL } from "../../contracts";
import { SIM_CREW, missionDayLabel, missionDayOf, store, useLive } from "../../data/db";
import { MetricTrend } from "../../ui/MetricTrend";
import { AddReadingForm } from "./AddReadingForm";
import { CumulativeChart } from "./CumulativeChart";

const HAZARD = HRP_HAZARDS.find((h) => h.id === "radiation")!;
const SOURCES = [
  {
    title: "NASA SRAG: How do we protect the astronauts from space radiation? (Crew Active Dosimeters)",
    url: "https://srag.jsc.nasa.gov/SpaceRadiation/How/How.cfm",
  },
  {
    title: "CSA: Monitoring radiation for astronaut health",
    url: "https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp",
  },
] as const;

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function RadiationPage() {
  const { data: readings, loading } = useLive(() => store.listRadiation(SIM_CREW.id), []);
  const rows = readings ?? [];

  return (
    <section className="panel radiation">
      <header className="page-head">
        <div>
          <h1>Personal radiation log</h1>
          <p className="muted">{SIM_CREW.displayName} (simulated)</p>
        </div>
        {/* Swap for Dev A's <HazardChip id="radiation" /> when src/ui/HazardChip lands (issue 1). */}
        <a className="hazard-chip" href={HRP_HAZARDS_URL} target="_blank" rel="noreferrer">
          NASA HRP hazard: {HAZARD.label}
        </a>
      </header>

      <p className="sim-banner" role="note">
        Simulated readings modeled on a crew dosimeter log. Not ISS data.
      </p>

      <div className="trend-grid two">
        <CumulativeChart readings={rows} />
        <MetricTrend crewId={SIM_CREW.id} metricKey="radiationRate" height={200} />
      </div>

      <AddReadingForm />

      <section className="dash-section">
        <div className="section-head">
          <h2>Readings</h2>
          <span className="muted small">{rows.length} logged</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>MD</th>
                <th>Time</th>
                <th>Rate (µGy/h)</th>
                <th>Cumulative (mGy, since log start)</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.id}>
                  <td>{missionDayLabel(missionDayOf(r.at))}</td>
                  <td>{timeOf(r.at)}</td>
                  <td>{r.rateUgyPerHour ?? "–"}</td>
                  <td>{r.cumulativeMgy.toFixed(3)}</td>
                  <td>{r.source}</td>
                </tr>
              ))}
              {!loading && !rows.length ? (
                <tr>
                  <td colSpan={5} className="muted">
                    No readings yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="why">
        <h2>Sources</h2>
        <p>
          Crew Active Dosimeters log each astronaut's own exposure throughout the mission, so a change in dose rate
          shows up while there is still time to act on it.
        </p>
        <ul>
          {SOURCES.map((s) => (
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
