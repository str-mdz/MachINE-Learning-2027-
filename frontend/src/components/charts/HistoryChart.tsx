import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { electionType, historical, percent, years } from "@/lib/electoral-data";
export function HistoryChart({ entity }: { entity?: string | undefined }) {
  const series = years.map((year) => {
    const row = historical(year, entity);
    return {
      year,
      type: electionType(year),
      abstention: row?.abstencion == null ? null : row.abstencion * 100,
    };
  });
  return (
    <figure className="history-chart">
      <figcaption className="method-note">Abstención observada · 2009–2024</figcaption>
      <div style={{ width: "100%", height: 225, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 18, right: 18, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="#e6ddeb" strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} interval={0} />
            <YAxis
              domain={[0, 100]}
              width={42}
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              labelFormatter={(year) => `${year} · ${electionType(Number(year))}`}
              formatter={(value) => [
                `${Number(value).toLocaleString("es-MX", { maximumFractionDigits: 10 })} %`,
                "Abstención observada",
              ]}
            />
            <Line
              type="linear"
              dataKey="abstention"
              stroke="#8054aa"
              strokeWidth={2}
              dot={{ r: 4, fill: "#8054aa" }}
              activeDot={{ r: 6 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="election-types">
        {series.map((r) => (
          <span key={r.year} className={r.type === "Presidencial" ? "presidential" : "midterm"}>
            {r.year} · {r.type}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Abstención observada por elección</caption>
        <thead>
          <tr>
            <th>Año</th>
            <th>Tipo</th>
            <th>Abstención</th>
          </tr>
        </thead>
        <tbody>
          {series.map((r) => (
            <tr key={r.year}>
              <td>{r.year}</td>
              <td>{r.type}</td>
              <td>{percent(r.abstention)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="method-note">
        Porcentaje entre registros conocidos. Datos históricos, no predicciones.
      </p>
    </figure>
  );
}
