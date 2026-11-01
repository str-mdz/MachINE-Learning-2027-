import type { ReactNode } from "react";
import validatedGeometry from "@/data/mapa_validado.json";
import type { StateData } from "@/lib/mexico";
import { NationalMap } from "./NationalMap";
import {
  changeDomain,
  mlWarning,
  ridge2024,
  baseline2024,
  colors,
  historyDomain,
  thresholds,
  percent,
  years,
  reductions,
  territory,
  mapCodes,
  scenarioValue,
  type Layer,
} from "@/lib/electoral-data";
export function TerritoryControls({
  layer,
  onLayer,
  year,
  onYear,
  action,
}: {
  action?: ReactNode;
  layer: Layer;
  onLayer: (v: Layer) => void;
  year: number;
  onYear: (v: number) => void;
  reduction: number;
  onReduction: (v: number) => void;
}) {
  return (
    <div className="territory-controls">
      <div className="view-buttons" aria-label="Visualización territorial">
        {(
          [
            ["history", "Histórico"],
            ["risk", "Riesgo 2027"],
            ["baseline", "Comparar"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            aria-pressed={layer === value || (value === "risk" && layer === "change")}
            onClick={() => onLayer(value)}
          >
            {label}
          </button>
        ))}
        {(layer === "risk" || layer === "change") && (
          <button
            aria-pressed={layer === "change"}
            onClick={() => onLayer(layer === "change" ? "risk" : "change")}
          >
            Cambio estimado 2021–2027
          </button>
        )}
        {action}
      </div>
      {layer === "history" && (
        <label>
          Año histórico
          <select value={year} onChange={(e) => onYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

export function Legend({ layer }: { layer: Layer }) {
  return (
    <div className="map-legend" aria-label="Leyenda de la capa">
      {layer === "change" ? (
        <>
          <span>
            <i style={{ background: "hsl(251, 38%, 38%)" }} />
            Disminución: −{changeDomain.toFixed(2)} pp
          </span>
          <span>
            <i style={{ background: "#f5f2fa" }} />
            Cerca de cero: 0 pp
          </span>
          <span>
            <i style={{ background: "hsl(320, 38%, 38%)" }} />
            Aumento: +{changeDomain.toFixed(2)} pp
          </span>
        </>
      ) : layer === "history" ? (
        <>
          <span className="gradient-key" />
          Participación observada · {percent(historyDomain[0])} a {percent(historyDomain[1])}
        </>
      ) : (
        <>
          <span>
            <i style={{ background: colors.bajo }} />
            Bajo ≤ {percent(thresholds[0])}
          </span>
          <span>
            <i style={{ background: colors.medio }} />
            Medio ≤ {percent(thresholds[1])}
          </span>
          <span>
            <i style={{ background: colors.alto }} />
            Alto &gt; {percent(thresholds[1])}
          </span>
        </>
      )}
      <span>
        <i style={{ background: colors.missing }} />
        Sin datos
      </span>
      <p>
        {layer === "history"
          ? "Participación entre registros conocidos. Año seleccionado; no es una proyección."
          : layer === "change"
            ? "Diferencia entre Ridge 2027 y lo observado en 2021, en puntos porcentuales. Escala simétrica centrada en cero; no es el semáforo ni un resultado garantizado."
            : "Estimación Ridge experimental 2027 · Los colores comparan niveles entre estados; no representan certezas."}
      </p>
      {layer !== "history" && mlWarning && (
        <p className="method-note" role="note">
          Ridge no superó la referencia en 2024: MAE {ridge2024.mae_pp.toFixed(2)} frente a{" "}
          {baseline2024.mae_pp.toFixed(2)} pp. Uso experimental.
        </p>
      )}
    </div>
  );
}
export function Comparison({
  selected,
  onSelect,
  reduction,
  onReduction,
}: {
  selected: string | null;
  onSelect: (s: string) => void;
  reduction: number;
  onReduction: (v: number) => void;
}) {
  const code = selected ? mapCodes[selected] : undefined;
  const base = scenarioValue(0, code);
  const simulated = scenarioValue(reduction, code);
  return (
    <section className="comparison" aria-label="Comparación territorial de escenarios">
      <div className="comparison-heading">
        <div>
          <h2>¿Qué cambia bajo el supuesto?</h2>
          <p>Escenarios sobre Ridge experimental: no demuestran el efecto de una intervención.</p>
        </div>
        <label>
          Supuesto comparativo
          <select value={reduction} onChange={(e) => onReduction(Number(e.target.value))}>
            {reductions.map((r) => (
              <option key={r} value={r}>
                Reducción de {r} pp
              </option>
            ))}
          </select>
        </label>
      </div>
      <Legend layer="risk" />
      <div className="comparison-grid">
        {(["baseline", "intervention"] as const).map((layer, i) => (
          <div key={layer}>
            <h3>{i ? "Con intervención hipotética" : "Sin intervención"}</h3>
            <p>
              {i ? `Reducción supuesta: ${reduction} pp` : "Estimación Ridge experimental 2027"}
            </p>
            <NationalMap
              selected={selected}
              hideWhenSelected={false}
              states={validatedGeometry as StateData[]}
              onSelect={onSelect}
              onHover={() => {}}
              appearance={(name) => territory(name, layer, 2021, reduction)}
            />
          </div>
        ))}
      </div>
      <div className="comparison-result" aria-live="polite">
        <strong>{selected ?? "México · Nacional ponderado"}</strong>
        <span>
          {percent(base)} → {percent(simulated)}
        </span>
        <span>
          Reducción:{" "}
          {base == null || simulated == null
            ? "No disponible"
            : `${(base - simulated).toLocaleString("es-MX", { maximumFractionDigits: 2 })} pp`}
        </span>
        {!code && <span>Pesos fijos: registros conocidos de 2021</span>}
      </div>
    </section>
  );
}
