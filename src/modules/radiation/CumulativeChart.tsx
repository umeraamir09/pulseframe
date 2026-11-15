import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import type { RadiationReading } from "../../contracts";
import { missionDayLabel, missionDayOf } from "../../data/db";
import { useElementWidth } from "../../ui/useElementWidth";

const C = { line: "#3987e5", surface: "#10151c", grid: "#232b36", axis: "#9aa6b2" };

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
        {missionDayLabel(missionDayOf(iso))} ·{" "}
        {new Date(p.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
      {p.rate !== undefined ? <div>rate {p.rate} µGy/h</div> : null}
      <div className="muted">{p.manual ? "manual entry" : "simulated CAD"}</div>
    </div>
  );
}

/** Cumulative dose since log start. Deliberately no limit or reference line. */
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

  return (
    <figure className="trend">
      <figcaption>
        <span>Cumulative dose (simulated)</span>
        <span className="trend-latest">{data.length ? `${data.at(-1)!.mgy.toFixed(3)} mGy` : "No data"}</span>
      </figcaption>
      <div ref={ref} style={{ height }}>
        {width > 0 && data.length ? (
          <LineChart width={width} height={height} data={data} margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={C.grid} />
            <XAxis
              type="number"
              dataKey="t"
              domain={["dataMin", "dataMax"]}
              ticks={ticks}
              tickFormatter={(t: number) => String(missionDayOf(new Date(t).toISOString()))}
              tick={{ fill: C.axis, fontSize: 11 }}
              axisLine={{ stroke: C.grid }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: C.axis, fontSize: 11 }}
              tickFormatter={(v: number) => v.toFixed(1)}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip content={<Tip />} cursor={{ stroke: C.axis, strokeWidth: 1, strokeDasharray: "3 3" }} />
            <Line
              type="linear"
              dataKey="mgy"
              stroke={C.line}
              strokeWidth={2}
              dot={{ r: 4, fill: C.line, stroke: C.surface, strokeWidth: 2 }}
              activeDot={{ r: 6, stroke: C.surface, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        ) : null}
      </div>
      <p className="muted small trend-note">mGy since log start. No limit line is shown.</p>
    </figure>
  );
}
