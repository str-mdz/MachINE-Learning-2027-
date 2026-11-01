import { demographicGroups } from "@/lib/demographics";
import { useState, useEffect } from "react";
import { z } from "zod";
const schema = z.object({
  registros: z.array(
    z.object({
      anio: z.number().int(),
      entidad_clave: z.string(),
      edad: z.number().nullable(),
      edad_revision: z.boolean(),
      sexo: z.string(),
      si_votaron: z.number().finite().nonnegative(),
      no_votaron: z.number().finite().nonnegative(),
    }),
  ),
});
import { percent, number, scenarioValue, classify, mapCodes } from "@/lib/electoral-data";
export function DemographicChart({
  year,
  entity,
  expanded = false,
  interpretations = false,
}: {
  year: number;
  entity: string | undefined;
  expanded?: boolean;
  interpretations?: boolean;
}) {
  const [indicator, setIndicator] = useState("abstencion");
  const [localShow, setShow] = useState(false);
  const show = expanded || localShow;
  const [data, setData] = useState<z.infer<typeof schema>["registros"]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!show || data.length) return;
    let active = true;
    fetch("/data/resumen_demografico.json")
      .then((r) => {
        if (!r.ok) throw Error("Datos no disponibles");
        return r.json();
      })
      .then((raw) => {
        const parsed = schema.parse(raw);
        if (active) setData(parsed.registros);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [show, data.length]);
  const groups = demographicGroups(data, year, entity);
  const highest = groups.reduce<(typeof groups)[number] | undefined>(
    (best, group) => (!best || group.rate > best.rate ? group : best),
    undefined,
  );
  const lowest = groups.reduce<(typeof groups)[number] | undefined>(
    (best, group) => (!best || group.rate < best.rate ? group : best),
    undefined,
  );
  const nationalGroups = demographicGroups(data, year);
  const place = entity
    ? (Object.keys(mapCodes).find((name) => mapCodes[name] === entity) ?? "Entidad seleccionada")
    : "México nacional";
  const findings =
    highest && lowest
      ? [
          {
            title: "Mayor abstención",
            group: highest,
            recommendation: `Para ${highest.label}, contrastar el resultado con un diagnóstico de acceso a información y servicios. Verificar barreras antes de proponer mejoras abiertas a toda la población.`,
          },
          {
            title: "Menor abstención · Mayor participación",
            group: lowest,
            recommendation: `Para ${lowest.label}, documentar la cobertura de servicios que convenga preservar y compararla entre elecciones. No atribuirle este resultado sin evidencia.`,
          },
        ]
      : [];
  const reference = scenarioValue(0, entity);
  return (
    <>
      {!expanded && (
        <button className="menu-chip" aria-expanded={show} onClick={() => setShow(!show)}>
          Participación por edad y sexo
        </button>
      )}
      <details className="help">
        <summary aria-label="Ayuda para interpretar">?</summary>
        <p>
          Cada porcentaje muestra qué parte de ese grupo de edad y sexo{" "}
          {indicator === "participacion" && !interpretations ? "participó" : "no votó"} en la
          elección. Los porcentajes no tienen que sumar 100 %, porque cada grupo se calcula por
          separado. Solo se cuentan registros con situación de votación conocida. Los registros con
          edades no especificadas o fuera del rango de revisión no se muestran en esta gráfica, pero
          se conservan en los datos originales.
        </p>
      </details>
      {show && (
        <div>
          {error && <p role="alert">No disponible: no se pudo cargar el resumen demográfico.</p>}
          {!data.length && !error && <p role="status">Cargando datos agregados…</p>}
          <p>
            Observado · {year} · {entity ? "Entidad seleccionada · " : ""}
            {place}
          </p>
          <p className="method-note">
            {indicator === "participacion" && !interpretations ? "Participación" : "Abstención"}{" "}
            histórica por edad y sexo. Datos observados, separados de la estimación 2027.
          </p>
          {!!data.length && !groups.length && (
            <p>No hay grupos con registros conocidos para esta selección.</p>
          )}
          {interpretations && !!findings.length && (
            <div className="demographic-cards">
              {findings.map(({ title, group, recommendation }) => (
                <article className="insight-card" key={title} aria-label={title}>
                  <h4>{title}</h4>
                  <p className="insight-group">{group.label}</p>
                  <strong className="insight-value">{percent(group.rate)}</strong>
                  <small>
                    Abstención · {year} · {place}
                  </small>
                  <small>Registros conocidos: {number(group.known)}</small>
                  <div className="insight-track" aria-hidden="true">
                    <i style={{ width: `${group.rate}%` }} />
                  </div>
                  {group.known < 30 && (
                    <p className="group-caution">
                      Menos de 30 registros conocidos: interpretar con especial cautela; este aviso
                      no es una prueba estadística.
                    </p>
                  )}
                  <div className="extreme-national">
                    {(() => {
                      const national = nationalGroups.find((g) => g.label === group.label);
                      return national ? (
                        <>
                          <small>
                            Equivalente nacional: {percent(national.rate)} · Registros conocidos:{" "}
                            {number(national.known)}
                          </small>
                          <small>
                            Diferencia entidad − nacional: {(group.rate - national.rate).toFixed(2)}{" "}
                            pp
                          </small>
                        </>
                      ) : (
                        <small>Sin equivalente nacional con registros conocidos.</small>
                      );
                    })()}
                  </div>
                  <p className="insight-action">{recommendation}</p>
                </article>
              ))}
              <section className="comparison-interpretation">
                <h3>Comparación e interpretación</h3>
                <div
                  className="extremes-visual"
                  role="figure"
                  aria-label="Comparación de los dos grupos extremos"
                >
                  {findings.map(({ title, group }) => (
                    <div key={title}>
                      <strong>
                        {title} · {group.label}
                      </strong>
                      <span>{percent(group.rate)}</span>
                      <div className="insight-track" aria-hidden="true">
                        <i style={{ width: `${group.rate}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <article className="insight-card" aria-label="Comparación nacional">
                  <h4>Comparación nacional · {year}</h4>
                  {entity ? (
                    findings.map(({ title, group }) => {
                      const national = nationalGroups.find((g) => g.label === group.label);
                      const difference = national ? group.rate - national.rate : null;
                      return (
                        <div className="group-comparison" key={title}>
                          <strong>
                            {title}: {group.label}
                          </strong>
                          {national ? (
                            <>
                              {[
                                { label: place, value: group },
                                { label: "México nacional", value: national },
                              ].map(({ label, value }) => (
                                <div key={label}>
                                  <span>
                                    {label}: {percent(value.rate)} · n = {number(value.known)}
                                  </span>
                                  <div className="insight-track" aria-hidden="true">
                                    <i style={{ width: `${value.rate}%` }} />
                                  </div>
                                </div>
                              ))}
                              <small>
                                Diferencia entidad − nacional: {difference! > 0 ? "+" : ""}
                                {difference!.toLocaleString("es-MX", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{" "}
                                pp
                              </small>
                            </>
                          ) : (
                            <p>Sin datos nacionales comparables para este grupo.</p>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p>
                      Ya estás viendo los porcentajes nacionales. Selecciona un estado para comparar
                      los mismos grupos y año.
                    </p>
                  )}
                </article>
                <article className="insight-card" aria-label="Interpretación">
                  <h4>Cómo interpretarlo</h4>
                  <ul>
                    <li>
                      Observaciones de {year}, no predicciones demográficas para 2027 ni evidencia
                      de causas.
                    </li>
                    <li>
                      Menor abstención significa mayor participación porcentual, no menos personas
                      en términos absolutos.
                    </li>
                    <li>
                      Pocos registros pueden producir porcentajes extremos. Los empates conservan el
                      orden de los grupos disponibles.
                    </li>
                  </ul>
                  <p>
                    {entity
                      ? `Semáforo 2027: riesgo relativo ${classify(reference)} (${percent(reference)}).`
                      : `Estimación ML nacional 2027: ${percent(reference)}, ponderada con registros conocidos de 2021.`}{" "}
                    El semáforo usa Ridge experimental para 2027; estos grupos históricos no
                    determinan automáticamente el color ni una probabilidad calibrada.
                  </p>
                </article>
              </section>
            </div>
          )}
          {!interpretations && (
            <label className="field-label">
              Indicador demográfico
              <select value={indicator} onChange={(event) => setIndicator(event.target.value)}>
                <option value="abstencion">Abstención</option>
                <option value="participacion">Participación</option>
              </select>
            </label>
          )}
          {!interpretations && !!groups.length && (
            <div className="aggregate-comparisons">
              {["edad", "sexo"].map((dimension) => {
                const aggregate = new Map<string, { yes: number; no: number }>();
                for (const g of groups) {
                  const label = g.label.split(" · ")[dimension === "sexo" ? 0 : 1]!;
                  const counts = aggregate.get(label) ?? { yes: 0, no: 0 };
                  counts.yes += g.yes;
                  counts.no += g.no;
                  aggregate.set(label, counts);
                }
                return (
                  <section key={dimension}>
                    <h3>Comparación por {dimension}</h3>
                    {[...aggregate].map(([label, counts]) => {
                      const known = counts.yes + counts.no;
                      const rate =
                        (100 * (indicator === "participacion" ? counts.yes : counts.no)) / known;
                      return (
                        <article className="demographic-row" key={label}>
                          <strong>
                            {label} · {percent(rate)}
                          </strong>
                          <small>Registros conocidos: {number(known)}</small>
                          {known < 30 && (
                            <small className="group-caution">
                              Menos de 30 registros conocidos: interpretar con especial cautela.
                            </small>
                          )}
                          <div className="insight-track" aria-hidden="true">
                            <i style={{ width: `${rate}%` }} />
                          </div>
                        </article>
                      );
                    })}
                  </section>
                );
              })}
            </div>
          )}
          {!interpretations && (
            <>
              <p className="method-note">
                Las comparaciones por edad y por sexo suman los conteos conocidos de los grupos
                visibles antes de calcular cada porcentaje; conservan las exclusiones de
                visualización documentadas.
              </p>
              <h3>Grupos de edad y sexo</h3>
            </>
          )}
          {!interpretations && (
            <div className="demographic-grid">
              {groups.map((g) => {
                const rate = indicator === "participacion" ? (100 * g.yes) / g.known : g.rate;
                return (
                  <div key={g.label} className="demographic-row">
                    <span>{g.label}</span>
                    <strong>
                      {percent(rate)}{" "}
                      {indicator === "participacion" ? "participaron" : "no votaron"}
                    </strong>
                    <small className="known-count">Registros conocidos: {number(g.known)}</small>
                    {g.known < 30 && (
                      <small className="group-caution">
                        Menos de 30 registros conocidos: interpretar con especial cautela.
                      </small>
                    )}
                    <div
                      aria-hidden="true"
                      style={{ width: `${rate ?? 0}%`, height: 8, background: "#8b65a9" }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
