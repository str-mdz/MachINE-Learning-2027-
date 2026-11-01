import { AboutProject, StateTable } from "@/components/layout/ProjectInfo";
import { createFileRoute } from "@tanstack/react-router";
import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, MousePointer2 } from "lucide-react";
import { STATES } from "@/lib/mexico";
import { SideMenu } from "@/components/layout/SideMenu";
import { TerritoryControls, Legend, Comparison } from "@/components/map/TerritoryControls";
import { territory, reductions, type Layer } from "@/lib/electoral-data";
import { NationalMap } from "@/components/map/NationalMap";

const State3D = lazy(() => import("@/components/map/State3D"));
export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "MachINE Learning 2027" },
      {
        name: "description",
        content: "Análisis histórico y escenarios de abstención electoral en México.",
      },
      { property: "og:title", content: "MachINE Learning 2027" },
    ],
  }),
  component: Index,
});

class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? (
      <div className="map-loading" role="alert">
        No se pudo iniciar la vista 3D. Comprueba que WebGL esté disponible o vuelve al mapa
        completo.
      </div>
    ) : (
      this.props.children
    );
  }
}

function Index() {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [layer, setLayer] = useState<Layer>("risk");
  const [laboratoryOpen, setLaboratoryOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>("resumen");
  const [tourStep, setTourStep] = useState<number | null>(null);
  const tourButton = useRef<HTMLButtonElement>(null);
  const tourHeading = useRef<HTMLHeadingElement>(null);
  const [year, setYear] = useState(2024);
  const [reduction, setReduction] = useState(reductions[0]!);
  const appearance = (name: string) => territory(name, layer, year, reduction);
  const [hoverName, setHoverName] = useState<string | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const stateSelector = useRef<HTMLSelectElement>(null);
  const selected = STATES.find((state) => state.n === selectedName) ?? null;
  function clearSelection() {
    setSelectedName(null);
    stateSelector.current?.focus();
  }
  useEffect(() => {
    if (!selectedName) return;
    if (
      !document.getElementById("analysis-panel")?.contains(document.activeElement) &&
      !(document.activeElement as HTMLElement | null)?.closest(".lab-panel")
    )
      closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector(".lab-panel")) {
        setSelectedName(null);
        stateSelector.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedName]);
  useEffect(() => {
    if (tourStep !== null) tourHeading.current?.focus();
  }, [tourStep]);
  function advanceTour(step: number) {
    setTourStep(step);
    setLayer(step === 0 ? "history" : step === 1 ? "risk" : "baseline");
    setOpenSection(step === 0 ? "historial" : step === 1 ? "riesgo" : "escenarios");
  }
  return (
    <main className="app-shell">
      <a href="#analysis-panel" className="skip-link">
        Saltar al análisis electoral
      </a>
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            M
          </span>
          <div>
            <h1>
              Mach<span className="brand-ine">INE</span> Learning <span>2027</span>
            </h1>
            <p>
              Plataforma de análisis predictivo y simulación de escenarios de abstención electoral
              en México
            </p>
          </div>
        </div>
        <div className="header-actions">
          <button ref={tourButton} className="menu-chip" onClick={() => advanceTour(0)}>
            Recorrido del proyecto
          </button>
          <AboutProject />
        </div>
      </header>
      {tourStep !== null && (
        <section className="project-tour" aria-label="Recorrido del proyecto">
          <h2 ref={tourHeading} tabIndex={-1}>
            Paso {tourStep + 1} de 3 ·{" "}
            {tourStep === 0
              ? "Explora la historia"
              : tourStep === 1
                ? "Compara 2021 con ML 2027"
                : "Consulta escenarios y evaluación"}
          </h2>
          <p>
            {tourStep === 0
              ? "Selecciona un año y una entidad en el mapa. El historial muestra datos observados."
              : tourStep === 1
                ? "Consulta la referencia observada de 2021, el ajuste experimental de Ridge y su diferencia."
                : "Explora los supuestos de reducción y abre el laboratorio para revisar errores y contribuciones."}
          </p>
          {tourStep > 0 && (
            <button className="menu-chip" onClick={() => advanceTour(tourStep - 1)}>
              Anterior
            </button>
          )}
          {tourStep < 2 ? (
            <button className="menu-chip" onClick={() => advanceTour(tourStep + 1)}>
              Siguiente
            </button>
          ) : (
            <button
              className="menu-chip"
              onClick={() => {
                setOpenSection("laboratorio");
                setLaboratoryOpen(true);
              }}
            >
              Abrir laboratorio
            </button>
          )}
          <button
            className="menu-chip"
            onClick={() => {
              setTourStep(null);
              tourButton.current?.focus();
            }}
          >
            Cerrar recorrido
          </button>
        </section>
      )}
      <div className="workspace">
        <section className="map-stage" aria-label="Explorador territorial">
          <div className="map-heading">
            <p className="eyebrow">32 entidades</p>
            <h2>
              El territorio, <span>en perspectiva.</span>
            </h2>
            <p>Selecciona un estado para conocer sus datos y explorarlo en 3D.</p>
          </div>
          <TerritoryControls
            action={<StateTable onSelect={setSelectedName} />}
            layer={layer}
            onLayer={(value) => {
              setLayer(value);
              if (value === "change") setOpenSection("riesgo");
            }}
            year={year}
            onYear={setYear}
            reduction={reduction}
            onReduction={setReduction}
          />
          {layer === "baseline" ? (
            <Comparison
              selected={selectedName}
              onSelect={setSelectedName}
              reduction={reduction}
              onReduction={setReduction}
            />
          ) : (
            <>
              <Legend layer={layer} />
              <div className="map-selector">
                <label htmlFor="state-select">Entidad federativa</label>
                <select
                  id="state-select"
                  ref={stateSelector}
                  value={selectedName ?? ""}
                  onChange={(event) => setSelectedName(event.target.value || null)}
                >
                  <option value="">México · Vista nacional</option>
                  {STATES.map((state) => (
                    <option key={state.n} value={state.n}>
                      {state.n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="map-viewport">
                <NationalMap
                  appearance={appearance}
                  selected={selectedName}
                  onSelect={setSelectedName}
                  onHover={setHoverName}
                />
                {selected && (
                  <div className="state-view">
                    <MapBoundary key={selected.n}>
                      <Suspense
                        fallback={
                          <div className="map-loading" role="status">
                            Preparando el terreno 3D…
                          </div>
                        }
                      >
                        <State3D
                          state={selected}
                          color={appearance(selected.n).color}
                          indicator={appearance(selected.n).label.split(" · ").slice(1).join(" · ")}
                        />
                      </Suspense>
                    </MapBoundary>
                    <button ref={closeButton} onClick={clearSelection} className="map-back">
                      <ArrowLeft size={16} />
                      Mapa completo
                    </button>
                  </div>
                )}
              </div>
              <div className="map-status">
                <span aria-live="polite">
                  <MousePointer2 size={14} />
                  {selectedName
                    ? "Arrastra para girar · Usa el zoom para acercarte"
                    : hoverName
                      ? appearance(hoverName).label
                      : "Selecciona una entidad para ver su valor"}
                </span>
              </div>
            </>
          )}
          <p className="method-note">
            Cartografía: <a href="https://www.geoboundaries.org/">geoBoundaries</a> · Fuente:
            INEGI, 2020. <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>;
            licencia de origen: <a href="https://creativecommons.org/licenses/by/3.0/igo/">CC BY 3.0 IGO</a>.
            Geometrías adaptadas; sin aval de los proveedores.
          </p>
        </section>
        <div id="analysis-panel" tabIndex={-1}>
          <SideMenu
            selected={selectedName}
            onSelect={setSelectedName}
            laboratoryOpen={laboratoryOpen}
            onLaboratoryOpen={setLaboratoryOpen}
            openSection={openSection}
            onOpenSection={setOpenSection}
            onClear={clearSelection}
            year={year}
            onYear={setYear}
            reduction={reduction}
            onReduction={setReduction}
            baseline={layer !== "baseline"}
            onScenario={(value) => {
              if (value > 0) setReduction(value);
              setLayer(value === 0 ? "risk" : "baseline");
            }}
          />
        </div>
      </div>
    </main>
  );
}
