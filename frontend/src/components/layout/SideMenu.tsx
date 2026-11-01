import { ExpandedPanel } from "./ExpandedPanel";
import { MLLaboratoryPanel } from "@/components/charts/MLLaboratory";
import { DemographicChart } from "@/components/charts/DemographicChart";
import { thresholds } from "@/lib/electoral-data";
import { useState } from "react";
import {
  ChevronDown,
  Info,
  History,
  Users,
  ShieldQuestion,
  SlidersHorizontal,
  Lightbulb,
} from "lucide-react";
import { HistoryChart } from "@/components/charts/HistoryChart";
import {
  mlWarning,
  ridge2024,
  baseline2024,
  historical,
  scenarioValue,
  classify,
  percent,
  number,
  mapCodes,
  reductions,
} from "@/lib/electoral-data";
function Help({ text }: { text: string }) {
  return (
    <details className="help">
      <summary aria-label="Ayuda para interpretar">?</summary>
      <p>{text}</p>
    </details>
  );
}
type Props = {
  selected: string | null;
  onClear: () => void;
  onSelect?: (name: string | null) => void;
  laboratoryOpen?: boolean;
  onLaboratoryOpen?: (value: boolean) => void;
  openSection?: string | null;
  onOpenSection?: (section: string | null) => void;
  year?: number;
  onYear?: (value: number) => void;
  reduction?: number;
  baseline?: boolean;
  onReduction?: (value: number) => void;
  onScenario?: (value: number) => void;
};
export function SideMenu({
  selected,
  onClear,
  onSelect,
  laboratoryOpen,
  onLaboratoryOpen,
  openSection,
  onOpenSection,
  year = 2024,
  onYear,
  reduction = reductions[0]!,
  onReduction,
  onScenario,
  baseline = false,
}: Props) {
  const [localOpen, setLocalOpen] = useState<string | null>("resumen");
  const open = openSection === undefined ? localOpen : openSection;
  const setOpen = onOpenSection ?? setLocalOpen;
  const [expanded, setExpanded] = useState<string | null>(null);
  const activePanel = laboratoryOpen ? "laboratorio" : expanded;
  function changeExpanded(id: string | null) {
    setExpanded(id);
    onLaboratoryOpen?.(id === "laboratorio");
  }
  const entity = selected ? mapCodes[selected] : undefined;
  const row = historical(year, entity);
  const base = scenarioValue(0, entity);
  const observed2021 = historical(2021, entity)?.abstencion;
  const previous = observed2021 == null ? null : observed2021 * 100;
  const simulated = scenarioValue(reduction, entity);
  const risk = entity ? classify(base) : null;
  const items = [
    {
      id: "resumen",
      label: "Resumen electoral",
      icon: Info,
      body: (
        <>
          <p className="selected-name">{selected ?? "México · Nacional"}</p>
          <span className="data-badge">Histórico observado · {year}</span>
          <dl className="electoral-fields">
            <div>
              <dt>Lista nominal</dt>
              <dd>{number(row?.lista_nominal)}</dd>
            </div>
            <div>
              <dt>Participación histórica</dt>
              <dd>{percent(row?.participacion == null ? null : row.participacion * 100)}</dd>
            </div>
            <div>
              <dt>Abstención histórica</dt>
              <dd>{percent(row?.abstencion == null ? null : row.abstencion * 100)}</dd>
            </div>
            <div>
              <dt>Registro no especificado (NS)</dt>
              <dd>{number(row?.no_especificados)}</dd>
            </div>
          </dl>
          <Help text="Participación = SV/(SV+NV). Abstención = NV/(SV+NV). Los no especificados se muestran aparte: no son abstención confirmada." />
          {selected && (
            <button onClick={onClear} className="menu-chip">
              Volver al mapa completo
            </button>
          )}
        </>
      ),
    },
    {
      id: "historial",
      label: "Historial 2009–2024",
      icon: History,
      body: (
        <>
          <HistoryChart entity={entity} />
        </>
      ),
    },
    {
      id: "demografia",
      label: "Participación por edad y sexo",
      icon: Users,
      body: null,
    },
    {
      id: "interpretaciones",
      label: "Interpretaciones por grupos",
      icon: Lightbulb,
      body: null,
    },
    {
      id: "riesgo",
      label: "Análisis de riesgo",
      icon: ShieldQuestion,
      body: (
        <>
          <span className="data-badge">Estimación ML 2027 · Experimental</span>
          <p className="metric">{percent(base)}</p>
          <p>Abstención estimada mediante Ridge</p>
          <dl className="electoral-fields risk-comparison">
            <div>
              <dt>Observado 2021</dt>
              <dd>{percent(previous)}</dd>
            </div>
            <div>
              <dt>Estimación ML 2027</dt>
              <dd>{percent(base)}</dd>
            </div>
            <div>
              <dt>Diferencia 2027 − 2021</dt>
              <dd>
                {base == null || previous == null
                  ? "No disponible"
                  : `${base - previous > 0 ? "↑ +" : base - previous < 0 ? "↓ " : "↔ "}${(base - previous).toLocaleString("es-MX", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} pp`}
              </dd>
            </div>
          </dl>
          {mlWarning && (
            <p className="method-note" role="note">
              En la prueba 2024, Ridge no superó la referencia del mismo tipo: MAE{" "}
              {ridge2024.mae_pp.toFixed(2)} frente a {baseline2024.mae_pp.toFixed(2)} pp. Uso
              experimental.
            </p>
          )}
          <p className="risk-label">
            {risk
              ? `Riesgo relativo ${risk}`
              : "Selecciona un estado para conocer su nivel de riesgo."}
          </p>
          {entity && (
            <div className="method-note">
              <p>
                <strong>¿Por qué este nivel de riesgo?</strong>
              </p>
              <p>
                {selected} tiene una abstención estimada de {percent(base)} y un riesgo relativo{" "}
                {risk}. Los límites son {percent(thresholds[0])} para bajo y{" "}
                {percent(thresholds[1])} para medio; por encima corresponde alto. Los terciles se
                calculan con las 32 estimaciones Ridge de 2027 y permanecen fijos al simular. Esto
                describe su posición, no las causas.
              </p>
            </div>
          )}
          <Help text="Compara las estimaciones Ridge entre 32 entidades mediante terciles de 2027. Bajo no significa abstención baja ni certeza de participación. Los cortes son fijos." />
          <p className="method-note">
            2027 es intermedia: Ridge ajusta estadísticamente la referencia de 2021 usando
            información disponible hasta 2024. No es una probabilidad calibrada ni garantiza
            precisión futura. Los grupos de edad y sexo describen el año histórico seleccionado y no
            determinan el semáforo.
          </p>
        </>
      ),
    },
    {
      id: "escenarios",
      label: "Simulador de escenarios",
      icon: SlidersHorizontal,
      body: (
        <>
          <p className="method-note">
            Base: estimación Ridge experimental 2027. Pesos nacionales: registros conocidos de 2021.
          </p>
          <label className="field-label" htmlFor="panel-reduction">
            Reducción hipotética
          </label>
          <select
            id="panel-reduction"
            value={reduction}
            onChange={(e) => onReduction?.(Number(e.target.value))}
          >
            {reductions.map((v) => (
              <option key={v} value={v}>
                {v} puntos porcentuales
              </option>
            ))}
          </select>
          <div className="scenario-metrics aligned-scenarios">
            {[
              { label: "Sin intervención", value: base },
              { label: "Con intervención hipotética", value: simulated },
            ].map((scenario) => (
              <div className="scenario-result" key={scenario.label}>
                <span>{scenario.label}</span>
                <strong>{percent(scenario.value)}</strong>
                <div className="scenario-track" aria-hidden="true">
                  <i style={{ width: `${scenario.value ?? 0}%` }} />
                </div>
              </div>
            ))}
          </div>
          {entity && (
            <p>
              {classify(base) === classify(simulated)
                ? "Se mantiene la categoría"
                : "Cambia la categoría"}
              : {classify(base)} → {classify(simulated)}
            </p>
          )}
          <Help
            text={[
              "¿Qué cambia en estos escenarios?",
              "El simulador muestra qué pasaría si más personas acudieran a votar. Al aumentar la participación, disminuye la abstención.",
              base == null || simulated == null
                ? ""
                : `Con la selección actual, la abstención pasaría de ${percent(base)} a ${percent(simulated)} y la participación aumentaría ${(base - simulated).toLocaleString("es-MX", { maximumFractionDigits: 2 })} puntos porcentuales. Son diferencias directas entre porcentajes, no cambios porcentuales relativos.`,
              "Estos cambios son hipotéticos y no representan resultados garantizados.",
            ]
              .filter(Boolean)
              .join("\n\n")}
          />
        </>
      ),
    },
    {
      id: "laboratorio",
      label: "Laboratorio de Machine Learning",
      icon: ShieldQuestion,
      body: (
        <MLLaboratoryPanel
          selected={selected}
          {...(onSelect ? { onSelect } : {})}
          open={activePanel === "laboratorio"}
          onOpenChange={(value) => changeExpanded(value ? "laboratorio" : null)}
        />
      ),
    },
    {
      id: "recomendaciones",
      label: "Recomendaciones",
      icon: Lightbulb,
      body: (
        <>
          <span className="data-badge">Propuestas preventivas · No efectos estimados</span>
          <article className="insight-card scenario-guidance">
            <h4>
              {baseline || reduction === 0
                ? "Sin intervención"
                : `Supuesto de reducción: ${reduction} pp`}
            </h4>
            <p>
              {baseline || reduction === 0
                ? "Revisar primero la situación histórica, las necesidades locales documentadas y la calidad de los datos."
                : reduction === 1
                  ? "Estudiar un piloto acotado con costos, cobertura e indicadores definidos antes de ejecutarlo."
                  : reduction === 3
                    ? "Antes de considerar mayor alcance, exigir evidencia de pilotos, capacidad operativa y evaluación de cobertura y costos."
                    : "Este supuesto más ambicioso exige comprobar viabilidad, recursos y resultados verificables antes de contemplar una ampliación."}
            </p>
            <small>
              Los escenarios son operaciones aritméticas sobre la estimación Ridge experimental.
              Ninguna de estas acciones tiene un efecto estimado de 1, 3 o 5 pp.
            </small>
          </article>
          <div className="preventive-cards">
            {[
              {
                title: "Información electoral accesible",
                description:
                  "Revisar claridad, disponibilidad y accesibilidad de los procedimientos publicados para toda la población.",
                action:
                  "Comprobar comprensión y accesibilidad de los materiales con una lista de revisión.",
              },
              {
                title: "Diagnóstico territorial",
                description:
                  "Identificar necesidades documentadas; el color del semáforo no explica sus causas.",
                action:
                  "Registrar barreras reportadas y contrastarlas con la cobertura de servicios.",
              },
              {
                title: "Evaluación de intervenciones",
                description: "Estudiar pilotos neutrales antes de ampliar una medida.",
                action:
                  "Definir indicadores, cobertura y comparación inicial antes de evaluar resultados.",
              },
              {
                title: "Calidad y cobertura de datos",
                description: `Revisar ${year} en ${selected ?? "México"}: ${number(row?.no_especificados)} registros NS, separados de la abstención confirmada.`,
                action:
                  "Contrastar NS, tamaños de grupos y cambios entre elecciones sin imputar faltantes.",
              },
              {
                title: "Uso responsable de recursos",
                description:
                  "Valorar necesidades acreditadas, costos y capacidad de atención; no asignar recursos automáticamente por el semáforo.",
                action:
                  "Comparar costo, cobertura y resultados verificables antes de aprobar una ampliación.",
              },
            ].map(({ title, description, action }, index) => (
              <article className="insight-card" key={title}>
                <h4>{title}</h4>
                <p>{description}</p>
                <p className="insight-action">
                  <strong>Acción verificable:</strong> {action}
                </p>
                <small>
                  Información para evaluar:{" "}
                  {
                    [
                      "materiales públicos, revisión de accesibilidad y resultados de comprensión.",
                      "barreras documentadas y cobertura de servicios territoriales.",
                      "indicadores iniciales, alcance, costos y resultados de pilotos neutrales.",
                      "conteos NS, registros conocidos y cambios de cobertura entre elecciones.",
                      "presupuesto, capacidad operativa, cobertura y resultados verificables.",
                    ][index]
                  }
                </small>
              </article>
            ))}
          </div>
        </>
      ),
    },
  ];
  return (
    <aside className="electoral-panel" aria-label="Panel de análisis electoral">
      <div className="panel-heading">
        <h2>{selected ?? "Panorama nacional"}</h2>
        <p>
          {entity
            ? "Explora su historia y los escenarios para 2027."
            : "Totales históricos y escenarios ponderados por registros conocidos."}
        </p>
      </div>
      {items.map(({ id, label, icon: Icon, body }) => (
        <section key={id} className="menu-item" data-open={open === id}>
          <h3>
            <button
              id={`heading-${id}`}
              className="panel-trigger"
              aria-expanded={open === id}
              aria-controls={`panel-${id}`}
              onClick={() => setOpen(open === id ? null : id)}
            >
              <span className="menu-icon">
                <Icon size={18} />
              </span>
              <span>{label}</span>
              <ChevronDown size={16} className={`chevron ${open === id ? "rotate-180" : ""}`} />
            </button>
          </h3>
          <div
            id={`panel-${id}`}
            role="region"
            aria-labelledby={`heading-${id}`}
            hidden={open !== id}
            className="panel-content"
          >
            {["demografia", "interpretaciones", "recomendaciones"].includes(id) ? (
              <ExpandedPanel
                title={label}
                open={activePanel === id}
                onOpenChange={(value) => changeExpanded(value ? id : null)}
                fallbackId={`heading-${id}`}
                launcher={
                  <>
                    <h4>{label}</h4>
                    {id !== "recomendaciones" && (
                      <strong>
                        {year} · {selected ?? "México nacional"}
                      </strong>
                    )}
                    <p>
                      {id === "recomendaciones"
                        ? "Propuestas neutrales de información pública, accesibilidad y evaluación. Consulta las acciones verificables para el supuesto activo."
                        : id === "interpretaciones"
                          ? "Consulta los grupos con mayor y menor abstención y compáralos con su equivalente nacional."
                          : "Compara participación y abstención observadas por edad y sexo, con sus registros conocidos."}
                    </p>
                  </>
                }
              >
                <div className="expanded-analysis">
                  <div className="analysis-controls">
                    <label>
                      Entidad del análisis
                      <select
                        value={selected ?? ""}
                        onChange={(event) => onSelect?.(event.target.value || null)}
                      >
                        <option value="">México · Vista nacional</option>
                        {Object.keys(mapCodes).map((name) => (
                          <option key={name}>{name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Año histórico del análisis
                      <select
                        value={year}
                        onChange={(event) => onYear?.(Number(event.target.value))}
                      >
                        {[2009, 2012, 2015, 2018, 2021, 2024].map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {id === "recomendaciones" ? (
                    <>
                      <label className="field-label">
                        Supuesto de recomendaciones
                        <select
                          value={baseline ? 0 : reduction}
                          onChange={(event) =>
                            (onScenario ?? onReduction)?.(Number(event.target.value))
                          }
                        >
                          <option value={0}>Base · Sin intervención</option>
                          {reductions.map((value) => (
                            <option key={value} value={value}>
                              Reducción hipotética de {value} pp
                            </option>
                          ))}
                        </select>
                      </label>
                      {body}
                    </>
                  ) : (
                    <DemographicChart
                      year={year}
                      entity={entity}
                      expanded
                      interpretations={id === "interpretaciones"}
                    />
                  )}
                </div>
              </ExpandedPanel>
            ) : (
              body
            )}
          </div>
        </section>
      ))}
      <p className="panel-footer">Fuente: Conteos Censales de Participación Ciudadana del INE.</p>
    </aside>
  );
}
