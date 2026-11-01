import { ModelChart } from "@/components/charts/ModelChart";
import { useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  mlMetadata,
  baseline2024,
  risks,
  historical,
  mapCodes,
  percent,
  number,
  colors,
} from "@/lib/electoral-data";
import evaluation from "@/data/comparacion_modelos.json";
export function AboutProject() {
  const result = evaluation.registros.find(
    (r) => r.periodo === "2024" && r.modelo === "ridge_residual",
  );
  const development = evaluation.registros.find(
    (r) => r.periodo === "2021" && r.modelo === "ridge_residual",
  )!;
  const largest = mlMetadata.errores_por_entidad
    .filter((r) => r.anio === 2024 && r.modelo === "ridge_residual")
    .sort((a, b) => b.error_absoluto_pp - a.error_absoluto_pp)
    .slice(0, 3);
  return (
    <Dialog>
      <DialogTrigger className="menu-chip">Acerca del proyecto</DialogTrigger>
      <DialogContent className="project-dialog">
        <DialogTitle>
          Mach<span className="brand-ine">INE</span> Learning 2027
        </DialogTitle>
        <DialogDescription>
          Plataforma interactiva para explorar la participación electoral en México, estimar
          escenarios de abstención y comparar posibles cambios territoriales.
        </DialogDescription>
        <h3>¿Qué hace este proyecto?</h3>
        <p>
          Analizamos las elecciones federales de 2009 a 2024 del INE. Entrenamos una estimación
          Ridge experimental para 2027, clasificamos los territorios por riesgo y comparamos
          escenarios hipotéticos.
        </p>
        <h3>Equipo desarrollador · The Malwares</h3>
        <ul>
          <li>Mendoza Camacho, Estrella de Maria</li>
          <li>Rodriguez Barrón, Emilio Humberto</li>
        </ul>
        <p>
          Hackathon Nacional del INE 2026 — Hackea la participación.
          <br />
          Eje 2: Predicción y escenarios de riesgo de abstención.
        </p>
        <h3>¿Cómo hicimos la estimación?</h3>
        <p>
          Estimamos la abstención estatal: NV/(SV+NV). Ridge es una regresión que limita el tamaño
          de sus coeficientes para reducir ajustes excesivos. Aprende un ajuste a la abstención de
          la última elección del mismo tipo; para la intermedia 2027 esa referencia es 2021.
        </p>
        <p>
          Usa siete variables de elecciones anteriores: brecha entre la última elección y la del
          mismo tipo, tipo de elección, proporción NS, logaritmo de lista nominal y proporciones de
          18–29 años, 60–120 años y mujeres. No usa información demográfica futura ni resultados de
          la elección que estima. La composición se calcula sobre la lista nominal histórica
          completa.
        </p>
        <p>
          Al comparar Ridge con los resultados reales de 2024, encontramos un error promedio de{" "}
          {result?.mae_pp.toFixed(2)} puntos porcentuales (RMSE {result?.rmse_pp.toFixed(2)} pp). La
          referencia del mismo tipo obtuvo MAE {baseline2024.mae_pp.toFixed(2)} pp: Ridge no la
          superó. Es una estimación experimental, no una mejora de precisión demostrada.
        </p>
        <ModelChart />
        <details>
          <summary>¿Qué significa MAE?</summary>
          <p>
            Es el error promedio entre lo estimado y lo observado, en puntos porcentuales. RMSE da
            más peso a los errores grandes. Ninguno es un intervalo de confianza.
          </p>
        </details>
        <details>
          <summary>¿Cómo entrenamos Ridge?</summary>
          <p>
            Para evaluar 2021 entrenamos con objetivos 2015 y 2018: MAE{" "}
            {development.mae_pp.toFixed(2)} pp, RMSE {development.rmse_pp.toFixed(2)} pp. Para
            evaluar 2024 añadimos 2021 al entrenamiento. El escalado se calcula solo con el
            entrenamiento y alpha=10 se conserva del protocolo anterior, sin ajustarlo con 2024. Las
            características siempre proceden de elecciones previas.
          </p>
          <p>
            El modelo final usa {mlMetadata.entrenamiento_final.n_train} ejemplos estatales de{" "}
            {mlMetadata.entrenamiento_final.train_years.join(", ")}, con antecedentes desde 2009. La
            tasa nacional y los escenarios se ponderan con registros conocidos de 2021, sin inventar
            población de 2027. Las tasas se restringen a 0–100 % y se conserva el resultado sin
            limitar.
          </p>
          <p>
            La evaluación de 2024 ya era conocida antes de adoptar Ridge experimentalmente; no
            constituye una prueba independiente de esta decisión. Solo hay dos elecciones
            retrospectivas de evaluación.
          </p>
        </details>
        <details>
          <summary>¿Dónde fueron mayores los errores?</summary>
          <ul>
            {largest.map((row) => (
              <li key={row.entidad_clave}>
                {row.entidad_nombre}: {row.error_absoluto_pp.toFixed(2)} pp de error absoluto en
                2024.
              </li>
            ))}
          </ul>
          <p>
            Son errores estatales individuales, no márgenes de confianza ni evidencia de causas. El
            modelo no aprende decisiones individuales ni garantiza el resultado de 2027.
          </p>
        </details>
        <details>
          <summary>Fuentes y limitaciones</summary>
          <ul className="source-notes">
            <li>
              <strong>Fuente de datos:</strong> Utilizamos los Conteos Censales de Participación
              Ciudadana del INE de 2009 a 2024.
            </li>
            <li>
              <strong>Estimaciones:</strong> Los resultados de 2027 se basan en elecciones
              anteriores. Los escenarios son hipotéticos y no garantizan resultados.
            </li>
          </ul>
        </details>
      </DialogContent>
    </Dialog>
  );
}
export function StateTable({ onSelect }: { onSelect: (name: string) => void }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("name");
  const entries = risks
    .map((r) => ({
      ...r,
      name: Object.keys(mapCodes).find((n) => mapCodes[n] === r.entidad_clave)!,
    }))
    .filter((r) =>
      r.name
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .includes(
          query
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .toLowerCase(),
        ),
    )
    .sort((a, b) =>
      sort === "rate"
        ? b.abstencion_referencia_pct - a.abstencion_referencia_pct
        : sort === "risk"
          ? ["alto", "medio", "bajo"].indexOf(a.riesgo_relativo) -
              ["alto", "medio", "bajo"].indexOf(b.riesgo_relativo) ||
            a.name.localeCompare(b.name, "es")
          : a.name.localeCompare(b.name, "es"),
    );
  return (
    <Dialog>
      <DialogTrigger className="menu-chip">Ver tabla de estados</DialogTrigger>
      <DialogContent className="project-dialog">
        <DialogTitle>Consulta territorial · 2027</DialogTitle>
        <DialogDescription>
          Estimaciones Ridge experimentales para 2027. Selecciona una entidad para verla en el mapa.
        </DialogDescription>
        <label>
          Buscar estado
          <input value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label>
          Ordenar
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="name">Alfabéticamente</option>
            <option value="rate">Mayor abstención</option>
            <option value="risk">Nivel de riesgo</option>
          </select>
        </label>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Estado</th>
                <th>Abstención 2027</th>
                <th>Riesgo</th>
                <th>Lista nominal 2021</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((r) => (
                <tr key={r.entidad_clave}>
                  <td>
                    <DialogClose asChild>
                      <button onClick={() => onSelect(r.name)}>{r.name}</button>
                    </DialogClose>
                  </td>
                  <td>{percent(r.abstencion_referencia_pct)}</td>
                  <td>
                    <span
                      style={{
                        borderLeft: `8px solid ${colors[r.riesgo_relativo]}`,
                        paddingLeft: 8,
                      }}
                    >
                      {r.riesgo_relativo}
                    </span>
                  </td>
                  <td>{number(historical(2021, r.entidad_clave)?.lista_nominal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!entries.length && <p>No se encontraron estados.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
