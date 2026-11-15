import { Area, CartesianGrid, ComposedChart, Line, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { KEY_LABELS, UNITS, type Alert, type MeasurementKey } from "../contracts";
import {
  FIRST_SEED_DAY,
  MISSION_DAY_TODAY,
  missionDayLabel,
  missionDayOf,
  missionDayStart,
  rollingBaselineSeries,
  store,
  useLive,
} from "../data/db";
import { useElementWidth } from "./useElementWidth";

/** Dark-surface tokens: series slot 1, status warning/critical, neutral axis ink. */
const C = {
  line: "#3987e5",
  band: "#3987e5",
  watch: "#fab219",
  act: "#d03b3b",
  caseMark: "#e8edf2",
  surface: "#10151c",
  grid: "#232b36",
  axis: "#9aa6b2",
};

const DAY_MS = 24 * 60 * 60 * 1000;

interface Point {
  t: number;
  value: number;
  measurementId: string;
  mean?: number;
  band?: [number, number];
  severity?: Alert["severity"];
  isCase?: boolean;
}

function fmt(v: number | undefined, digits = 1): string {
  return v === undefined ? "–" : Number.isInteger(v) ? String(v) : v.toFixed(digits);
}

function TrendTooltip({ active, payload, unit }: { active?: boolean; payload?: { payload: Point }[]; unit: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="chart-tip">
      <strong>
        {fmt(p.value)} {unit}
      </strong>
      <div className="muted">
        {missionDayLabel(missionDayOf(new Date(p.t).toISOString()))} ·{" "}
        {new Date(p.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        {p.isCase ? " · emergency test" : ""}
      </div>
      {p.band ? (
        <div>
          μ {fmt(p.mean)} · band {fmt(p.band[0])} to {fmt(p.band[1])}
        </div>
      ) : !p.isCase ? (
        <div className="muted">Baseline still burning in</div>
      ) : null}
      {p.severity ? <div>{p.severity === "act" ? "Act" : "Watch"} alert</div> : null}
    </div>
  );
}

function Dot(props: { cx?: number; cy?: number; payload?: Point }) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined || !payload) return null;
  const fill = payload.severity === "act" ? C.act : payload.severity === "watch" ? C.watch : C.line;
  return <circle cx={cx} cy={cy} r={payload.severity ? 5 : 4} fill={fill} stroke={C.surface} strokeWidth={2} />;
}

function Diamond(props: { cx?: number; cy?: number; payload?: Point }) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined) return null;
  const s = 6;
  const fill = payload?.severity === "act" ? C.act : payload?.severity === "watch" ? C.watch : C.caseMark;
  return (
    <path
      d={`M${cx},${cy - s} L${cx + s},${cy} L${cx},${cy + s} L${cx - s},${cy} Z`}
      fill={fill}
      stroke={C.surface}
      strokeWidth={2}
    />
  );
}

/**
 * One metric over the mission week: values as a line, the rolling personal baseline as a μ ± 2σ band,
 * alert readings colored by severity, and emergency-test readings as separate diamonds.
 */
export function MetricTrend({
  crewId,
  metricKey,
  days = MISSION_DAY_TODAY - FIRST_SEED_DAY + 1,
  height = 150,
}: {
  crewId: string;
  metricKey: MeasurementKey;
  days?: number;
  height?: number;
}) {
  const [boxRef, width] = useElementWidth<HTMLDivElement>();
  const firstDay = MISSION_DAY_TODAY - days + 1;
  const from = missionDayStart(firstDay).getTime();
  const to = missionDayStart(MISSION_DAY_TODAY).getTime() + DAY_MS;

  const { data } = useLive(async () => {
    // Pull 7 extra days so the first plotted points have their own baseline window.
    const [rows, alerts] = await Promise.all([
      store.listMeasurements(crewId, new Date(from - 7 * DAY_MS).toISOString()),
      store.listAlerts(crewId),
    ]);
    return { rows: rows.filter((m) => m.key === metricKey), alerts: alerts.filter((a) => a.key === metricKey) };
  }, [crewId, metricKey, from]);

  const unit = UNITS[metricKey];
  const sev = new Map((data?.alerts ?? []).filter((a) => a.measurementId).map((a) => [a.measurementId!, a.severity]));

  const line: Point[] = rollingBaselineSeries(data?.rows ?? [], metricKey)
    .map((p) => ({
      t: Date.parse(p.takenAt),
      value: p.value,
      measurementId: p.measurementId,
      mean: p.mean,
      band: p.low !== undefined && p.high !== undefined ? ([p.low, p.high] as [number, number]) : undefined,
      severity: sev.get(p.measurementId),
    }))
    .filter((p) => p.t >= from && p.t < to);

  const cases: Point[] = (data?.rows ?? [])
    .filter((m) => m.caseId)
    .map((m) => ({ t: Date.parse(m.takenAt), value: m.value, measurementId: m.id, severity: sev.get(m.id), isCase: true }))
    .filter((p) => p.t >= from && p.t < to);

  const ys = [...line.flatMap((p) => [p.value, ...(p.band ?? [])]), ...cases.map((p) => p.value)];
  const lo = ys.length ? Math.min(...ys) : 0;
  const hi = ys.length ? Math.max(...ys) : 1;
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.12;
  const ticks = Array.from({ length: days }, (_, i) => missionDayStart(firstDay + i).getTime() + DAY_MS / 2);
  const latest = line.at(-1);

  return (
    <figure className="trend">
      <figcaption>
        <span>{KEY_LABELS[metricKey]}</span>
        <span className="trend-latest">
          {latest ? `${fmt(latest.value)} ${unit}` : "No data"}
          {latest?.severity ? <span className={`sev-dot ${latest.severity}`} aria-label={`${latest.severity} alert`} /> : null}
        </span>
      </figcaption>
      <div ref={boxRef} className="trend-box" style={{ height }}>
        {width > 0 ? (
          <ComposedChart width={width} height={height} data={line} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={C.grid} />
            <XAxis
              type="number"
              dataKey="t"
              domain={[from, to]}
              ticks={ticks}
              tickFormatter={(t: number) => String(missionDayOf(new Date(t).toISOString()))}
              tick={{ fill: C.axis, fontSize: 11 }}
              axisLine={{ stroke: C.grid }}
              tickLine={false}
              allowDataOverflow
            />
            <YAxis
              type="number"
              domain={[lo - pad, hi + pad]}
              tick={{ fill: C.axis, fontSize: 11 }}
              tickFormatter={(v: number) => fmt(v)}
              axisLine={false}
              tickLine={false}
              width={40}
              allowDataOverflow
            />
            <Tooltip
              content={<TrendTooltip unit={unit} />}
              cursor={{ stroke: C.axis, strokeWidth: 1, strokeDasharray: "3 3" }}
            />
            <Area
              type="linear"
              dataKey="band"
              stroke="none"
              fill={C.band}
              fillOpacity={0.16}
              isAnimationActive={false}
              connectNulls={false}
              activeDot={false}
            />
            <Line
              type="linear"
              dataKey="value"
              stroke={C.line}
              strokeWidth={2}
              dot={<Dot />}
              activeDot={{ r: 6, stroke: C.surface, strokeWidth: 2 }}
              isAnimationActive={false}
            />
            {cases.length ? (
              <Scatter data={cases} dataKey="value" shape={<Diamond />} name="emergency test" isAnimationActive={false} />
            ) : null}
          </ComposedChart>
        ) : null}
      </div>
      {cases.length ? <p className="muted small trend-note">◆ emergency test (kept out of the baseline)</p> : null}
    </figure>
  );
}
