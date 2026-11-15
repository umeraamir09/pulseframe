import { useState } from "react";
import type { Alert } from "../../contracts";
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
import { Chip } from "../../ui/Chip";
import { HazardChip } from "../../ui/HazardChip";
import { Icon } from "../../ui/Icon";
import { TrendChart } from "../../ui/MetricTrend";
import { fmt, useTrend } from "../../ui/useTrend";
import { usePageMeta } from "../../ui/pageMeta";
import { AddReadingForm } from "./AddReadingForm";
import { CumulativeChart } from "./CumulativeChart";

const SOURCES = [
  {
    title: "NASA SRAG: Crew Active Dosimeters",
    url: "https://srag.jsc.nasa.gov/SpaceRadiation/How/How.cfm",
  },
  {
    title: "CSA: Monitoring radiation for astronaut health",
    url: "https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp",
  },
] as const;

const SHOW = 5;

export function RadiationPage() {
  usePageMeta(
    "Personal radiation log",
    `Simulated dosimeter, ${missionDayLabel(FIRST_SEED_DAY)} to ${missionDayLabel(MISSION_DAY_TODAY)}`,
  );
  const [adding, setAdding] = useState(false);
  const [all, setAll] = useState(false);
  const weekStart = missionDayStart(FIRST_SEED_DAY).toISOString();
  const { data: readings, loading } = useLive(() => store.listRadiation(SIM_CREW.id), []);
  const { data: alerts } = useLive(
    () => store.listAlerts(SIM_CREW.id).then((rows) => rows.filter((a) => a.key === "radiationRate")),
    [],
  );
  const trend = useTrend(SIM_CREW.id, "radiationRate");
  const rows = readings ?? [];
  const latest = rows.at(-1);
  const week = rows.filter((r) => r.at >= weekStart);
  const firstWeek = week[0];
  const weekDose = latest && firstWeek ? latest.cumulativeMgy - firstWeek.cumulativeMgy : undefined;
  const base = trend.latestBaseline;
  const latestAlert = latest ? alertAt(alerts ?? [], latest.at) : undefined;
  const shown = [...rows].reverse().slice(0, all ? undefined : SHOW);

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="rad-top">
        <section className="card" aria-label="Rate now">
          <div className="card-head" style={{ alignItems: "center" }}>
            <span className="muted" style={{ fontWeight: 500 }}>
              Rate now
            </span>
            {latest ? <Chip tone={latestAlert && !latestAlert.ackedAt ? latestAlert.severity : "normal"} /> : null}
          </div>
          <div className="big-value">
            <span className="numeral-xl">{latest?.rateUgyPerHour !== undefined ? latest.rateUgyPerHour.toFixed(1) : "–"}</span>
            <span className="unit">µGy/h</span>
          </div>
          <span className="muted small">
            μ {fmt(base?.mean)} · band μ ± 2σ
          </span>
        </section>

        <section className="card" aria-label="This week">
          <span className="muted" style={{ fontWeight: 500 }}>
            This week
          </span>
          <div className="big-value">
            <span className="numeral-xl">{weekDose !== undefined ? weekDose.toFixed(2) : "–"}</span>
            <span className="unit">mGy</span>
          </div>
          <span className="muted small">Since the first {missionDayLabel(FIRST_SEED_DAY)} reading</span>
        </section>

        <section className="card" aria-label="About this log">
          <span className="tag watch" style={{ alignSelf: "flex-start", height: 30, padding: "0 14px" }}>
            <Icon name="flask" size={16} /> Simulated, not ISS data
          </span>
          <div>
            <HazardChip id="radiation" />
          </div>
          <p className="muted small">No limit line is shown. This log is a trend, not a dose limit check.</p>
        </section>
      </div>

      <div className="rad-charts">
        <section className="card" aria-labelledby="cum-title">
          <p className="overline">Cumulative</p>
          <h2 id="cum-title" className="h2">
            {weekDose !== undefined ? `${weekDose.toFixed(2)} mGy this week` : "Cumulative dose"}
          </h2>
          <CumulativeChart readings={week} />
        </section>
        <section className="card" aria-labelledby="rate-title">
          <p className="overline">Rate trend</p>
          <h2 id="rate-title" className="h2">
            µGy/h with your μ ± 2σ band
          </h2>
          <TrendChart trend={trend} height={200} />
        </section>
      </div>

      <section className="card" aria-labelledby="readings-title">
        <div className="card-head" style={{ alignItems: "center", marginBottom: 16 }}>
          <h2 id="readings-title" className="h3" style={{ fontSize: 20 }}>
            Readings
          </h2>
          <button type="button" className="btn secondary" aria-expanded={adding} onClick={() => setAdding((a) => !a)}>
            <Icon name={adding ? "x" : "plus"} size={18} /> {adding ? "Close" : "Add reading"}
          </button>
        </div>
        {adding ? <AddReadingForm /> : null}
        <div className="table-wrap" style={{ marginTop: adding ? 16 : 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Time</th>
                <th>Rate</th>
                <th>Cumulative</th>
                <th>Source</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const a = alertAt(alerts ?? [], r.at);
                return (
                  <tr key={r.id}>
                    <td>{missionDayLabel(missionDayOf(r.at))}</td>
                    <td className="muted">{new Date(r.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                    <td>{r.rateUgyPerHour !== undefined ? `${r.rateUgyPerHour.toFixed(1)} µGy/h` : "–"}</td>
                    <td>{r.cumulativeMgy.toFixed(3)} mGy</td>
                    <td>{r.source === "manual" ? "Manual entry" : "Simulated dosimeter"}</td>
                    <td>{a ? <Chip tone={a.severity} /> : <Chip tone="normal" />}</td>
                  </tr>
                );
              })}
              {!loading && !rows.length ? (
                <tr>
                  <td colSpan={6} className="muted">
                    No readings yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="row wrap" style={{ marginTop: 14, justifyContent: "space-between" }}>
          {rows.length > SHOW ? (
            <button type="button" className="btn ghost sm" onClick={() => setAll((v) => !v)}>
              {all ? "Show latest" : `Show all ${rows.length}`}
            </button>
          ) : (
            <span />
          )}
          <span className="muted small">
            Sources:{" "}
            {SOURCES.map((s, i) => (
              <span key={s.url}>
                {i ? " · " : ""}
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.title}
                </a>
              </span>
            ))}
          </span>
        </div>
      </section>
    </div>
  );
}

/** The rate alert raised by the measurement logged with this reading, matched by timestamp. */
function alertAt(alerts: Alert[], at: string): Alert | undefined {
  return alerts.find((a) => a.openedAt === at);
}
