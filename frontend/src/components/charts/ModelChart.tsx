import evaluation from "@/data/comparacion_modelos.json";
const names: Record<string, string> = {
  mismo_tipo: "Última elección del mismo tipo",
  ridge_residual: "Regresión ridge",
  ultima_eleccion: "Última elección",
  ultimo_ajustado_tipo: "Última elección + ajuste por tipo",
};
export function ModelChart({
  year = 2024,
  metric = "mae_pp",
}: {
  year?: number;
  metric?: "mae_pp" | "rmse_pp";
}) {
  const rows = evaluation.registros
    .filter((r) => r.periodo === String(year))
    .sort((a, b) => a[metric] - b[metric]);
  const maximum = Math.max(...rows.map((r) => r[metric]));
  const metricName = metric === "mae_pp" ? "MAE" : "RMSE";
  return (
    <figure className="model-chart">
      <figcaption>
        {metric === "mae_pp" ? "Comparación histórica de métodos" : "Comparación histórica de RMSE"}{" "}
        · {year}
      </figcaption>
      <p className="method-note">
        Un {metricName} menor indica que las estimaciones estuvieron, en promedio, más cerca de los
        resultados observados.
      </p>
      <div className="scenario-metrics aligned-scenarios">
        {rows.map((r) => (
          <div key={r.modelo} className="scenario-result">
            <span>
              {r[metric] === rows[0]?.[metric] && (
                <small className="known-count">Menor {metricName} observado</small>
              )}
              {names[r.modelo] ?? r.modelo}
              {r.modelo === "ridge_residual" && (
                <small className="known-count">Modelo experimental utilizado para 2027</small>
              )}
            </span>
            <strong>{r[metric].toFixed(2)} pp</strong>
            {metric === "mae_pp" && <small>RMSE: {r.rmse_pp.toFixed(2)} pp</small>}
            <div className="scenario-track" aria-hidden="true">
              <i
                style={{
                  width: `${maximum ? (r[metric] / maximum) * 100 : 0}%`,
                  background: r.modelo === "ridge_residual" ? "#8054aa" : "#c8bad8",
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="method-note">
        Escala: 0 a {maximum.toFixed(2)} pp.{" "}
        {year === 2024
          ? `Ridge obtuvo ${metricName} ${rows.find((r) => r.modelo === "ridge_residual")![metric].toFixed(2)} pp frente a ${rows.find((r) => r.modelo === "mismo_tipo")![metric].toFixed(2)} pp de la referencia del mismo tipo; no la superó.`
          : `El ajuste por tipo obtuvo el menor ${metricName}; Ridge mejoró la referencia del mismo tipo, pero no fue el mejor método.`}{" "}
        La evaluación retrospectiva no garantiza el error de 2027.
      </p>
    </figure>
  );
}
