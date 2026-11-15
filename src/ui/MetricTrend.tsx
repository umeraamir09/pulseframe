import { Area, ComposedChart, Line, ReferenceLine, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { missionDayLabel, missionDayOf } from "../data/db";
import { useElementWidth } from "./useElementWidth";
import { CHART, fmt, type Trend, type TrendPoint } from "./useTrend";

function TrendTooltip({ active, payload, unit }: { active?: boolean; payload?: { payload: TrendPoint }[]; unit: string }) {
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

function Dot(props: { cx?: number; cy?: number; payload?: TrendPoint }) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined || !payload) return null;
  if (payload.severity) {
    const c = payload.severity === "act" ? CHART.act : CHART.watch;
    const soft = payload.severity === "act" ? CHART.actSoft : CHART.watchSoft;
    return (
      <g>
        <circle cx={cx} cy={cy} r={10} fill={soft} />
        <circle cx={cx} cy={cy} r={5.5} fill={c} stroke={CHART.surface} strokeWidth={2} />
      </g>
    );
  }
  return <circle cx={cx} cy={cy} r={5} fill={CHART.surface} stroke={CHART.ink} strokeWidth={2} />;
}

function Diamond(props: { cx?: number; cy?: number; payload?: TrendPoint }) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined) return null;
  const s = 7;
  const fill = payload?.severity === "act" ? CHART.act : payload?.severity === "watch" ? CHART.watch : CHART.ink;
  return (
    <path
      d={`M${cx},${cy - s} L${cx + s},${cy} L${cx},${cy + s} L${cx - s},${cy} Z`}
      fill={fill}
      stroke={CHART.surface}
      strokeWidth={2}
    />
  );
}

/** Line with white dots on a light-blue μ ± 2σ band and dashed μ, as in the Figma trend cards. */
export function TrendChart({
  trend,
  height = 150,
  lineColor = CHART.ink,
  showAxis = true,
}: {
  trend: Trend;
  height?: number;
  lineColor?: string;
  showAxis?: boolean;
}) {
  const [boxRef, width] = useElementWidth<HTMLDivElement>();
  const { line, cases, from, to, ticks, unit } = trend;
  const ys = [...line.flatMap((p) => [p.value, ...(p.band ?? [])]), ...cases.map((p) => p.value)];
  const lo = ys.length ? Math.min(...ys) : 0;
  const hi = ys.length ? Math.max(...ys) : 1;
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.15;
  const mean = trend.latestBaseline?.mean;

  return (
    <div className="trend-box">
      <div ref={boxRef} style={{ height }}>
        {width > 0 ? (
          <ComposedChart width={width} height={height} data={line} margin={{ top: 12, right: 12, bottom: 0, left: 12 }}>
            <XAxis
              type="number"
              dataKey="t"
              domain={[from, to]}
              ticks={ticks}
              hide={!showAxis}
              tickFormatter={(t: number) => missionDayLabel(missionDayOf(new Date(t).toISOString()))}
              tick={{ fill: CHART.axis, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              allowDataOverflow
            />
            <YAxis type="number" domain={[lo - pad, hi + pad]} hide allowDataOverflow />
            <ReferenceLine y={hi + pad} stroke={CHART.grid} />
            <ReferenceLine y={lo - pad} stroke={CHART.grid} />
            {mean !== undefined ? <ReferenceLine y={mean} stroke={CHART.bandEdge} strokeDasharray="5 5" strokeOpacity={0.6} /> : null}
            <Tooltip content={<TrendTooltip unit={unit} />} cursor={{ stroke: CHART.axis, strokeWidth: 1, strokeDasharray: "3 3" }} />
            <Area
              type="linear"
              dataKey="band"
              stroke="none"
              fill={CHART.band}
              fillOpacity={1}
              isAnimationActive={false}
              connectNulls={false}
              activeDot={false}
            />
            <Line
              type="linear"
              dataKey="value"
              stroke={lineColor}
              strokeWidth={2}
              dot={<Dot />}
              activeDot={{ r: 6, fill: CHART.surface, stroke: lineColor, strokeWidth: 2 }}
              isAnimationActive={false}
            />
            {cases.length ? (
              <Scatter data={cases} dataKey="value" shape={<Diamond />} name="emergency test" isAnimationActive={false} />
            ) : null}
          </ComposedChart>
        ) : null}
      </div>
      {cases.length ? <p className="faint small">◆ emergency test, kept out of the baseline</p> : null}
    </div>
  );
}
