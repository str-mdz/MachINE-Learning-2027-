import { ExpandedPanel } from "@/components/layout/ExpandedPanel";
import { SensitivityChart } from "./SensitivityChart";
import research from "@/data/evaluacion_ridge.json";
import { useRef, useState } from "react";
import { ModelChart } from "./ModelChart";
import {
  mlMetadata,
  mapCodes,
  percent,
  ridge2024,
  baseline2024,
  projections,
  historical,
  scenarioValue,
} from "@/lib/electoral-data";
import { contributions, downloadResults } from "@/lib/ml-insights";

export function MLLaboratory({
  selected,
  onSelect,
  onClose,
}: {
  selected: string | null;
  onSelect?: (name: string | null) => void;
  onClose?: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState("resumen");
  const [showAll, setShowAll] = useState(false);
  const [year, setYear] = useState(2024);
  const [order, setOrder] = useState("high");
  const entity = selected ? mapCodes[selected] : undefined;
  const errors = mlMetadata.errores_por_entidad
    .filter((r) => r.anio === 2024 && r.modelo === "ridge_residual")
    .sort((a, b) =>
      order === "high"
        ? b.error_absoluto_pp - a.error_absoluto_pp
        : a.error_absoluto_pp - b.error_absoluto_pp,
    );
  const observed = errors.find((r) => r.entidad_clave === entity);
  const baseline = mlMetadata.errores_por_entidad.find(
    (r) => r.anio === 2024 && r.modelo === "mismo_tipo" && r.entidad_clave === entity,
  );
  const explanation = entity ? contributions(entity) : undefined;
  const projection = projections.find((r) => r.entidad_clave === entity);
  const terms = explanation
    ? [...explanation.terms].sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    : [];
  const maximum = Math.max(...errors.map((r) => r.error_absoluto_pp));
  const termMaximum = Math.max(1e-12, ...terms.map((r) => Math.abs(r.value)));
  const development = mlMetadata.errores_por_entidad.filter(
    (r) => r.anio === 2021 && r.modelo === "ridge_residual",
  );
  const developmentMae =
    development.reduce((sum, r) => sum + r.error_absoluto_pp, 0) / development.length;
  function selectTab(value: string) {
    setTab(value);
    const panel = root.current?.closest(".lab-panel");
    if (panel) panel.scrollTop = 0;
  }
  const tabs = [
    { id: "resumen", label: "Resumen del modelo" },
    { id: "validacion", label: "Validación y comparación" },
    { id: "entidad", label: "Evaluación por entidad" },
    { id: "explicabilidad", label: "Explicabilidad" },
  ];
  const candidate = research.resultados.find(
    (row) =>
      row.anio === 2021 && row.configuracion === research.decision.candidato_seleccionado_2021,
  )!;
  const exploratory = research.resultados.find(
    (row) => row.anio === 2024 && row.configuracion === research.decision.minimo_exploratorio_2024,
  )!;
  const variants = research.resultados.filter((row) => row.anio === year);
  const maxMae = Math.max(...variants.map((row) => row.mae_pp));
  const maxRmse = Math.max(...variants.map((row) => row.rmse_pp));
  const national2021 = historical(2021)!.abstencion! * 100;
  const national2027 = scenarioValue(0)!;
  return (
    <div className="ml-laboratory" ref={root}>
      <div className="lab-topbar">
        <div>
          <h2>Laboratorio de Machine Learning</h2>
          <p>Ridge residual · Evaluación temporal y explicaciones verificables</p>
        </div>
        {onClose && (
          <button className="menu-chip" aria-label="Cerrar laboratorio" onClick={onClose}>
            Cerrar ×
          </button>
        )}
        <div className="lab-tabs" role="tablist" aria-label="Vistas del laboratorio">
          {tabs.map((item, index) => (
            <button
              key={item.id}
              id={`lab-tab-${item.id}`}
              role="tab"
              aria-selected={tab === item.id}
              aria-controls={`lab-content-${item.id}`}
              tabIndex={tab === item.id ? 0 : -1}
              onClick={() => selectTab(item.id)}
              onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? tabs.length - 1
                      : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
                selectTab(tabs[next]!.id);
                document.getElementById(`lab-tab-${tabs[next]!.id}`)?.focus();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <section
        className="lab-tab-content"
        id={`lab-content-${tab}`}
        role="tabpanel"
        aria-labelledby={`lab-tab-${tab}`}
      >
        {tab === "resumen" && (
          <>
            <div className="lab-overview">
              <article>
                <span>Estimación nacional ML 2027</span>
                <strong>{percent(national2027)}</strong>
                <small>Experimental · Ponderación 2021</small>
              </article>
              <article>
                <span>Abstención observada 2021</span>
                <strong>{percent(national2021)}</strong>
                <small>Registros con votación conocida</small>
              </article>
              <article>
                <span>Diferencia estimada</span>
                <strong>{(national2027 - national2021).toFixed(2)} pp</strong>
                <small>No es un resultado garantizado</small>
              </article>
              <article>
                <span>Modelo operativo</span>
                <strong>Ridge residual</strong>
                <small>
                  alpha={mlMetadata.alpha} · lambda=1 · {mlMetadata.entrenamiento_final.n_train}{" "}
                  observaciones · siete variables
                </small>
              </article>
            </div>
            <p className="lab-notice">
              Ridge no superó la referencia del mismo tipo en 2024. Se conserva el modelo original;
              no hay un nuevo corte independiente que confirme una mejora.
            </p>
            <dl className="lab-metrics">
              <div>
                <dt>MAE 2024 · Ridge</dt>
                <dd>{ridge2024.mae_pp.toFixed(2)} pp</dd>
              </div>
              <div>
                <dt>RMSE 2024 · Ridge</dt>
                <dd>{ridge2024.rmse_pp.toFixed(2)} pp</dd>
              </div>
              <div>
                <dt>MAE 2024 · Referencia</dt>
                <dd>{baseline2024.mae_pp.toFixed(2)} pp</dd>
              </div>
              <div>
                <dt>RMSE 2024 · Referencia</dt>
                <dd>{baseline2024.rmse_pp.toFixed(2)} pp</dd>
              </div>
            </dl>
            <article className="insight-card">
              <h4>Qué sabemos del error</h4>
              <p>
                MAE Ridge: {developmentMae.toFixed(2)} pp en 2021 y {ridge2024.mae_pp.toFixed(2)} pp
                en 2024. En 2024 fue ligeramente peor que la referencia (
                {baseline2024.mae_pp.toFixed(2)} pp).
              </p>
              <p>
                Solo hay dos cortes temporales de evaluación. El error histórico no garantiza
                precisión para 2027 y no es un intervalo de confianza.
              </p>
            </article>
          </>
        )}
        {tab === "validacion" && (
          <>
            <label className="field-label" htmlFor="lab-year">
              Evaluación de modelos
            </label>
            <select
              id="lab-year"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            >
              <option value={2021}>Evaluación 2021</option>
              <option value={2024}>Evaluación 2024</option>
            </select>
            <div className="lab-chart-pair">
              <ModelChart year={year} />
              <ModelChart year={year} metric="rmse_pp" />
            </div>

            <section className="lab-research">
              <h3>Regularización e intensidad del ajuste</h3>
              <p>
                Comparación complementaria de las 15 configuraciones predefinidas. Todas usan las
                mismas siete variables y escalado solo de entrenamiento. Ninguna sustituye al modelo
                publicado.
              </p>
              <p className="lab-notice">
                El candidato se elige solo con 2021: alpha={candidate.alpha}, lambda=
                {candidate.intensidad}. El mínimo retrospectivo de 2024 (alpha={exploratory.alpha},
                lambda={exploratory.intensidad}) no se utiliza para seleccionar. No existe una nueva
                evaluación independiente.
              </p>
              <table className="variant-table">
                <caption>Las 15 variantes · Evaluación {year} · Barras MAE y RMSE en pp</caption>
                <thead>
                  <tr>
                    <th>alpha</th>
                    <th>lambda</th>
                    <th>MAE</th>
                    <th>RMSE</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((row) => (
                    <tr
                      key={row.configuracion}
                      data-operative={
                        row.configuracion === research.decision.configuracion_operativa
                      }
                    >
                      <th scope="row">
                        {row.alpha}
                        {row.configuracion === research.decision.configuracion_operativa && (
                          <small>Operativo</small>
                        )}
                        {row.configuracion === research.decision.candidato_seleccionado_2021 && (
                          <small>Candidato 2021</small>
                        )}
                      </th>
                      <td>{row.intensidad}</td>
                      <td>
                        <strong>{row.mae_pp.toFixed(2)}</strong>
                        <div className="variant-track" aria-hidden="true">
                          <i style={{ width: `${(100 * row.mae_pp) / maxMae}%` }} />
                        </div>
                      </td>
                      <td>
                        <strong>{row.rmse_pp.toFixed(2)}</strong>
                        <div className="variant-track" aria-hidden="true">
                          <i style={{ width: `${(100 * row.rmse_pp) / maxRmse}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                lambda=0 conserva la referencia histórica; lambda=1 aplica el residual completo. Los
                valores intermedios reducen su intensidad. El mejor resultado en un año no demuestra
                estabilidad en otro.
              </p>
              <details>
                <summary>Variables y límites del diagnóstico</summary>
                <p>{research.protocolo.corte_2018}</p>
                <p>
                  En entrenamiento anterior a 2021, rango de las siete características
                  estandarizadas: {research.diagnostico.rango_caracteristicas_estandarizadas};
                  número de condición: {research.diagnostico.numero_condicion.toFixed(2)}.
                </p>
                <p>
                  Brecha previa y tipo de elección presentan correlación{" "}
                  {research.diagnostico.correlaciones_altas[0]?.correlacion.toFixed(3)}. No es una
                  identidad ni justifica eliminar variables usando errores de 2024. Se conservan las
                  siete características.
                </p>
              </details>
            </section>
          </>
        )}
        {tab === "entidad" && (
          <>
            <article className="insight-card">
              <h4>Evaluación por entidad · 2024</h4>
              <label className="field-label" htmlFor="lab-entity">
                Entidad del mapa
              </label>
              <select
                id="lab-entity"
                value={selected ?? ""}
                onChange={(event) => onSelect?.(event.target.value || null)}
              >
                <option value="">Selecciona una entidad</option>
                {Object.keys(mapCodes).map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
              {observed && baseline ? (
                <dl className="lab-metrics">
                  <div>
                    <dt>Observado 2024</dt>
                    <dd>{percent(observed.objetivo_abstencion_pp)}</dd>
                  </div>
                  <div>
                    <dt>Ridge retrospectivo 2024</dt>
                    <dd>{percent(observed.prediccion_abstencion_pp)}</dd>
                  </div>
                  <div>
                    <dt>Error absoluto Ridge</dt>
                    <dd>{observed.error_absoluto_pp.toFixed(2)} pp</dd>
                  </div>
                  <div>
                    <dt>Referencia del mismo tipo</dt>
                    <dd>{percent(baseline.prediccion_abstencion_pp)}</dd>
                  </div>
                  <div>
                    <dt>Error absoluto referencia</dt>
                    <dd>{baseline.error_absoluto_pp.toFixed(2)} pp</dd>
                  </div>
                </dl>
              ) : (
                <p>Selecciona un estado aquí o en el mapa para consultar su evaluación.</p>
              )}
              <small>
                Predicciones de validación hechas entrenando únicamente con elecciones anteriores a
                2024.
              </small>
            </article>
            <section className="lab-details">
              <h3>Errores absolutos por entidad · 2024</h3>
              <label className="field-label" htmlFor="lab-sort">
                Ordenar errores
              </label>
              <select
                id="lab-sort"
                value={order}
                onChange={(event) => setOrder(event.target.value)}
              >
                <option value="high">Mayor a menor</option>
                <option value="low">Menor a mayor</option>
              </select>
              <p className="method-note">
                Escala de 0 a {maximum.toFixed(2)} pp. Línea punteada: MAE Ridge{" "}
                {ridge2024.mae_pp.toFixed(2)} pp. Selecciona una fila para consultar ese estado.
              </p>
              <div
                className="error-chart"
                tabIndex={0}
                role="region"
                aria-label={
                  showAll
                    ? "32 errores absolutos de Ridge en 2024"
                    : "Resumen de ocho errores de Ridge en 2024"
                }
              >
                {(showAll ? errors : errors.slice(0, 8)).map((row) => {
                  const name = Object.keys(mapCodes).find(
                    (key) => mapCodes[key] === row.entidad_clave,
                  )!;
                  return (
                    <button
                      key={row.entidad_clave}
                      className="error-row"
                      aria-pressed={entity === row.entidad_clave}
                      onClick={() => onSelect?.(name)}
                      aria-label={`${name}: error absoluto ${row.error_absoluto_pp.toFixed(2)} pp en 2024`}
                    >
                      <span>{name}</span>
                      <span className="error-track" aria-hidden="true">
                        <i style={{ width: `${(100 * row.error_absoluto_pp) / maximum}%` }} />
                        <b style={{ left: `${(100 * ridge2024.mae_pp) / maximum}%` }} />
                      </span>
                      <strong>{row.error_absoluto_pp.toFixed(2)}</strong>
                    </button>
                  );
                })}
              </div>
              <button className="menu-chip" onClick={() => setShowAll(!showAll)}>
                {showAll ? "Ver resumen de ocho" : "Ver las 32 entidades"}
              </button>
              <small>Errores retrospectivos; no son márgenes garantizados para 2027.</small>
            </section>
          </>
        )}
        {tab === "explicabilidad" && (
          <>
            <label className="field-label" htmlFor="lab-explain-entity">
              Entidad del mapa
            </label>
            <select
              id="lab-explain-entity"
              value={selected ?? ""}
              onChange={(event) => onSelect?.(event.target.value || null)}
            >
              <option value="">Selecciona una entidad</option>
              {Object.keys(mapCodes).map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
            <section className="lab-details">
              <h3>¿Cómo calcula su estimación el modelo?</h3>
              <p>
                El modelo operativo usa lambda=1 y aplica el residual completo a la abstención de
                2021. Cada contribución es el coeficiente multiplicado por la variable histórica
                estandarizada con las medias y escalas del entrenamiento.
              </p>
              {explanation && projection ? (
                <>
                  <p>
                    <strong>{selected} · Ajuste 2027</strong>
                  </p>
                  <p>
                    Intercepto: {explanation.intercept.toFixed(4)} pp. Suma de las siete
                    contribuciones e intercepto:{" "}
                    <strong>{explanation.residual.toFixed(4)} pp</strong>.
                  </p>
                  <p className="method-note">
                    Tres variables de mayor magnitud. ← Disminuye el ajuste · Aumenta el ajuste →
                  </p>
                  <div className="lab-explanation-grid">
                    <div>
                      {terms.slice(0, 3).map((term) => (
                        <div className="contribution-row" key={term.name}>
                          <span>{term.label}</span>
                          <strong>
                            {term.value >= 0 ? "+" : ""}
                            {term.value.toFixed(3)} pp · {term.value < 0 ? "Disminuye" : "Aumenta"}
                          </strong>
                          <div className="contribution-track" aria-hidden="true">
                            <i
                              style={{
                                left: `${term.value < 0 ? 50 - (50 * Math.abs(term.value)) / termMaximum : 50}%`,
                                width: `${(50 * Math.abs(term.value)) / termMaximum}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <table className="contribution-table">
                      <caption>Las siete contribuciones · puntos porcentuales</caption>
                      <thead>
                        <tr>
                          <th>Variable</th>
                          <th>Contribución</th>
                        </tr>
                      </thead>
                      <tbody>
                        {explanation.terms.map((term) => (
                          <tr key={term.name}>
                            <th scope="row">{term.label}</th>
                            <td>{term.value.toFixed(4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p>
                    2021: {percent(projection.abstencion_2021_pct)} + ajuste:{" "}
                    {explanation.residual.toFixed(4)} pp ={" "}
                    {percent(projection.prediccion_sin_limitar_pct)} antes de limitar a 0–100 %.
                    Publicado: {percent(projection.abstencion_referencia_pct)}.
                  </p>
                </>
              ) : (
                <p>
                  Selecciona una entidad para ver sus contribuciones. No se inventan contribuciones
                  nacionales.
                </p>
              )}
              <small>
                Son contribuciones estadísticas, no causas ni explicaciones de decisiones
                individuales.
              </small>
            </section>
            <SensitivityChart entity={entity} />
          </>
        )}
      </section>
      <div className="lab-downloads" aria-label="Descarga de resultados">
        <h4>Descargar resultados · UTF-8</h4>
        <button className="menu-chip" onClick={() => downloadResults("all")}>
          CSV · 32 entidades
        </button>
        <button className="menu-chip" onClick={() => downloadResults("national")}>
          CSV · Nacional
        </button>
        {entity && (
          <button className="menu-chip" onClick={() => downloadResults(entity)}>
            CSV · {selected}
          </button>
        )}
        <small>
          Incluye 2021, Ridge 2027, cambio, riesgo y escenarios base, −1, −3 y −5 pp. No modifica el
          CSV oficial.
        </small>
      </div>
    </div>
  );
}

export function MLLaboratoryPanel({
  selected,
  onSelect,
  open,
  onOpenChange,
}: {
  selected: string | null;
  onSelect?: (name: string | null) => void;
  open?: boolean;
  onOpenChange?: (value: boolean) => void;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  function changeOpen(value: boolean) {
    if (open === undefined) setLocalOpen(value);
    onOpenChange?.(value);
  }
  return (
    <ExpandedPanel
      title="Laboratorio de Machine Learning ampliado"
      open={open ?? localOpen}
      onOpenChange={changeOpen}
      fallbackId="heading-laboratorio"
      triggerLabel="Abrir laboratorio"
      ownHeader
      launcher={
        <>
          <h4>Evaluación y explicabilidad de Ridge</h4>
          <p>
            Compara métodos, revisa errores por estado y explora las contribuciones reales en una
            vista amplia.
          </p>
          <strong>MAE 2024: {ridge2024.mae_pp.toFixed(2)} pp</strong>
          <small>Experimental; la referencia obtuvo {baseline2024.mae_pp.toFixed(2)} pp.</small>
        </>
      }
    >
      <MLLaboratory
        selected={selected}
        {...(onSelect ? { onSelect } : {})}
        onClose={() => changeOpen(false)}
      />
    </ExpandedPanel>
  );
}
