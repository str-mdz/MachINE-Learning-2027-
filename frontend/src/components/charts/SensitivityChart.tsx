import sensitivity from "@/data/sensibilidad_ridge.json";
import { featureNames } from "@/lib/ml-insights";
import { percent } from "@/lib/electoral-data";

export function SensitivityChart({ entity }: { entity?: string | undefined }) {
  const row = sensitivity.registros.find((r) => r.entidad_clave === entity);
  const maximum = Math.max(0.001, ...(row?.variables.map((v) => v.amplitud_pp) ?? []));
  function chart(all: boolean) {
    return (
      <div
        className="sensitivity-chart"
        role="figure"
        aria-label={all ? "Sensibilidad de seis entradas" : "Tres entradas con mayor sensibilidad"}
      >
        {(all ? row!.variables : row!.variables.slice(0, 3)).map((v) => (
          <article key={v.variable}>
            <strong>{featureNames[v.variable]}</strong>
            <span>Amplitud: {v.amplitud_pp.toFixed(3)} pp</span>
            <div className="insight-track" aria-hidden="true">
              <i style={{ width: `${(100 * v.amplitud_pp) / maximum}%` }} />
            </div>
            <small>
              Entrada original: {v.entrada_original.toFixed(4)} · Rango histórico:{" "}
              {v.minimo.toFixed(4)} a {v.maximo.toFixed(4)}
            </small>
            <small>
              Cambio frente al original:{" "}
              {v.extremos
                .map((e) => `${e.cambio_pp >= 0 ? "+" : ""}${e.cambio_pp.toFixed(3)}`)
                .join(" / ")}{" "}
              pp · Extremo inferior / superior
            </small>
            {all && (
              <>
                <small>
                  Años de las entradas: {v.anios_fuente.join(", ")} · {v.n_observaciones}{" "}
                  observaciones
                </small>
                <small>
                  Estimaciones del ejercicio:{" "}
                  {v.extremos.map((e) => percent(e.estimacion_pct)).join(" / ")}
                </small>
                {v.variable === "log_ln_previa" && (
                  <small>Escala de logaritmo natural de la lista nominal; no son personas.</small>
                )}
                {(v.variable.startsWith("prop_") || v.variable === "ns_previo") && (
                  <small>Proporción en escala 0–1.</small>
                )}
              </>
            )}
          </article>
        ))}
      </div>
    );
  }
  return (
    <section className="lab-details sensitivity-section">
      <h3>Sensibilidad de las estimaciones</h3>
      <p>
        Una entrada a la vez, con el modelo publicado fijo. Los extremos delimitan el recorrido de
        esta función lineal con límites 0–100. Mayor amplitud indica mayor dependencia matemática
        dentro del rango examinado; también depende de la amplitud de ese rango.
      </p>
      {row ? (
        <>
          <p>
            <strong>
              {row.entidad_nombre} · Estimación original: {percent(row.original_pct)}
            </strong>
          </p>
          {chart(false)}
          <details>
            <summary>Consultar las seis entradas y sus rangos</summary>
            {chart(true)}
          </details>
        </>
      ) : (
        <p>
          Selecciona una entidad para consultar su sensibilidad. No se inventa un diagnóstico
          nacional.
        </p>
      )}
      <p>{sensitivity.rango}</p>
      <p>
        El tipo de elección permanece fijo: intermedia. Las proporciones respetan 0–1 y jóvenes +
        mayores ≤ 1.
      </p>
      <p className="lab-notice">{sensitivity.limitacion}</p>
    </section>
  );
}
