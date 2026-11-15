import { Area, ComposedChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import type { RadiationReading } from "../../contracts";
import { missionDayLabel, missionDayOf } from "../../data/db";
import { CHART } from "../../ui/useTrend";
import { useElementWidth } from "../../ui/useElementWidth";

interface Point {
  t: number;
  mgy: number;
  rate?: number;
  manual: boolean;
}

function Tip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const iso = new Date(p.t).toISOString();
  return (
    <div className="chart-tip">
      <strong>{p.mgy.toFixed(3)} mGy</strong>
      <div className="muted">
        {missionDayLabel(missionDayOf(iso))} · {new Date(p.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
      {p.rate !== undefined ? <div>rate {p.rate} µGy/h</div> : null}
      <div className="muted">{p.manual ? "manual entry" : "simulated dosimeter"}</div>
    </div>
  );
}

/** Cumulative dose since log start, one point per reading. Deliberately no limit or reference line. */
export function CumulativeChart({ readings, height = 200 }: { readings: RadiationReading[]; height?: number }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const data: Point[] = readings.map((r) => ({
    t: Date.parse(r.at),
    mgy: r.cumulativeMgy,
    rate: r.rateUgyPerHour,
    manual: r.source === "manual",
  }));
  // One tick per mission day, at that day's first reading.
  const ticks: number[] = [];
  const seen = new Set<number>();
  for (const p of data) {
    const md = missionDayOf(new Date(p.t).toISOString());
    if (!seen.has(md)) {
      seen.add(md);
      ticks.push(p.t);
    }
  }
  const lo = data.length ? Math.min(...data.map((d) => d.mgy)) : 0;
  const hi = data.length ? Math.max(...data.map((d) => d.mgy)) : 1;

  return (
    <div ref={ref} style={{ height }}>
      {width > 0 && data.length ? (
        <ComposedChart width={width} height={height} data={data} margin={{ top: 12, right: 12, bottom: 0, left: 12 }}>
          <XAxis
            type="number"
            dataKey="t"
            domain={["dataMin", "dataMax"]}
            ticks={ticks}
            tickFormatter={(t: number) => missionDayLabel(missionDayOf(new Date(t).toISOString()))}
            tick={{ fill: CHART.axis, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis domain={[lo, hi + (hi - lo) * 0.05 || 1]} hide />
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <ReferenceLine key={f} y={lo + (hi - lo) * f} stroke={CHART.grid} />
          ))}
          <Tooltip content={<Tip />} cursor={{ stroke: CHART.axis, strokeWidth: 1, strokeDasharray: "3 3" }} />
          <Area
            type="linear"
            dataKey="mgy"
            stroke={CHART.line}
            strokeWidth={2}
            fill={CHART.band}
            fillOpacity={1}
            dot={{ r: 4, fill: CHART.surface, stroke: CHART.line, strokeWidth: 2 }}
            activeDot={{ r: 6, fill: CHART.surface, stroke: CHART.line, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      ) : null}
    </div>
  );
}
