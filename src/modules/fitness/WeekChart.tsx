import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DayBar } from "./fitnessStats";

/** Dark-surface categorical slots 1 and 2 (validated), planned in neutral gray. */
const COLORS = {
  planned: "#4a5361",
  resistive: "#3987e5",
  aerobic: "#d95926",
  grid: "#232b36",
  axis: "#9aa6b2",
};

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: DayBar }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="chart-tip">
      <strong>{d.label}</strong>
      <div>Planned: {d.planned} min</div>
      <div>
        <i style={{ background: COLORS.resistive }} /> Resistive done: {d.resistive} min
      </div>
      <div>
        <i style={{ background: COLORS.aerobic }} /> Aerobic done: {d.aerobic} min
      </div>
    </div>
  );
}

export function WeekChart({ data }: { data: DayBar[] }) {
  return (
    <figure className="week-chart">
      <figcaption>Planned vs completed minutes, by mission day</figcaption>
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="22%" margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke={COLORS.grid} />
            <XAxis dataKey="label" tick={{ fill: COLORS.axis, fontSize: 12 }} axisLine={{ stroke: COLORS.grid }} tickLine={false} />
            <YAxis
              tick={{ fill: COLORS.axis, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              unit=" m"
              allowDecimals={false}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgb(255 255 255 / 0.04)" }} />
            <Legend wrapperStyle={{ fontSize: 12, color: COLORS.axis }} iconType="square" />
            <Bar dataKey="planned" name="Planned" fill={COLORS.planned} radius={[4, 4, 0, 0]} />
            <Bar dataKey="resistive" name="Resistive done" stackId="done" fill={COLORS.resistive} stroke="#10151c" strokeWidth={1} />
            <Bar
              dataKey="aerobic"
              name="Aerobic done"
              stackId="done"
              fill={COLORS.aerobic}
              stroke="#10151c"
              strokeWidth={1}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="chart-table">
        <summary>Show as table</summary>
        <table>
          <thead>
            <tr>
              <th>Day</th>
              <th>Planned</th>
              <th>Resistive done</th>
              <th>Aerobic done</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.md}>
                <td>{d.label}</td>
                <td>{d.planned} min</td>
                <td>{d.resistive} min</td>
                <td>{d.aerobic} min</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
