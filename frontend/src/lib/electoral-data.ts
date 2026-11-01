import { z } from "zod";
import mlRaw from "@/data/modelo_ridge.json";
import evaluation from "@/data/comparacion_modelos.json";
import historyRaw from "@/data/participacion_estatal.json";
import riskRaw from "@/data/semaforo_territorial.json";
import scenarioRaw from "@/data/escenarios_2027.json";
import nationalRaw from "@/data/resumen_nacional.json";
import projectionRaw from "@/data/proyeccion_2027.json";
import { STATES } from "./mexico";
import type { RiskLevel } from "@/types/electoral";

const code = z.string().regex(/^(0[1-9]|[12][0-9]|3[0-2])$/);
const pct = z.number().finite().min(0).max(100);
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const rate = z.number().finite().min(0).max(1).nullable();
const historySchema = z.object({
  anio: z.number().int(),
  entidad_clave: code,
  entidad_nombre: z.string(),
  lista_nominal: count,
  si_votaron: count,
  no_votaron: count,
  no_especificados: count,
  conocidos: count,
  participacion: rate,
  abstencion: rate,
});
const riskSchema = z.object({
  entidad_clave: code,
  entidad_nombre: z.string(),
  anio_proyeccion: z.literal(2027),
  abstencion_referencia_pct: pct,
  riesgo_relativo: z.enum(["bajo", "medio", "alto"]),
  umbral_bajo_pct: pct,
  umbral_medio_pct: pct,
});
const scenarioSchema = z.object({
  entidad_clave: code,
  anio_proyeccion: z.literal(2027),
  anio_fuente: z.literal(2024),
  escenario: z.enum(["sin_intervencion", "con_intervencion"]),
  reduccion_supuesta_pp: pct,
  reduccion_efectiva_pp: pct,
  abstencion_referencia_pct: pct,
  abstencion_escenario_pct: pct,
  participacion_escenario_pct: pct,
  conocidos_2021: count,
  peso_nacional: z.number().finite().min(0).max(1),
});
const nationalSchema = z.object({
  reduccion_supuesta_pp: pct,
  abstencion_nacional_pct: pct,
  participacion_nacional_pct: pct,
  denominador_conocidos_2021: count,
});

export function parseTable<T extends z.ZodTypeAny>(
  raw: unknown,
  schema: T,
  name: string,
): z.infer<T>[] {
  const table = z
    .object({
      schema_version: z.literal("1.0"),
      tabla: z.literal(name),
      fuente_sha256: z.string().regex(/^[a-f0-9]{64}$/),
      filas: count,
      registros: z.array(schema),
    })
    .parse(raw);
  if (table.filas !== table.registros.length) throw new Error(`Filas inconsistentes: ${name}`);
  return table.registros;
}
export type HistoryRow = z.infer<typeof historySchema>;
export const history = parseTable(historyRaw, historySchema, "participacion_estatal");
export const risks = parseTable(riskRaw, riskSchema, "semaforo_territorial");
export const scenarios = parseTable(scenarioRaw, scenarioSchema, "escenarios_2027");
export const nationals = parseTable(nationalRaw, nationalSchema, "resumen_nacional");
export const projections = parseTable(
  projectionRaw,
  z.object({
    entidad_clave: code,
    entidad_nombre: z.string(),
    abstencion_referencia_pct: pct,
    abstencion_2021_pct: pct,
    residual_estimado_pp: z.number().finite(),
    prediccion_sin_limitar_pct: z.number().finite(),
    diferencia_2021_2027_pp: z.number().finite(),
    limitada_0_100: z.boolean(),
    metodo: z.literal("ridge_residual"),
    anio_fuente: z.literal(2024),
    anio_proyeccion: z.literal(2027),
  }),
  "proyeccion_2027",
);
export const mlMetadata = mlRaw;
export const ridge2024 = evaluation.registros.find(
  (r) => r.periodo === "2024" && r.modelo === "ridge_residual",
)!;
export const baseline2024 = evaluation.registros.find(
  (r) => r.periodo === "2024" && r.modelo === "mismo_tipo",
)!;
export const mlWarning = ridge2024.mae_pp > baseline2024.mae_pp;
export const years = [...new Set(history.map((r) => r.anio))].sort();
export const reductions = [...new Set(scenarios.map((r) => r.reduccion_supuesta_pp))]
  .filter((x) => x > 0)
  .sort((a, b) => a - b);
export const thresholds = [risks[0]!.umbral_bajo_pct, risks[0]!.umbral_medio_pct] as const;
export const colors = { bajo: "#91CBB9", medio: "#F1D58C", alto: "#E5A0A8", missing: "#C9C8D2" };
export const percent = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value)
    ? "No disponible"
    : `${value.toLocaleString("es-MX", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} %`;
export const number = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value)
    ? "No disponible"
    : value.toLocaleString("es-MX", { maximumFractionDigits: 0 });
export function classify(value: number | null | undefined): RiskLevel | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value <= thresholds[0] ? "bajo" : value <= thresholds[1] ? "medio" : "alto";
}

export const mapCodes: Record<string, string> = {
  Aguascalientes: "01",
  "Baja California": "02",
  "Baja California Sur": "03",
  Campeche: "04",
  Coahuila: "05",
  Colima: "06",
  Chiapas: "07",
  Chihuahua: "08",
  "Ciudad de México": "09",
  Durango: "10",
  Guanajuato: "11",
  Guerrero: "12",
  Hidalgo: "13",
  Jalisco: "14",
  México: "15",
  Michoacán: "16",
  Morelos: "17",
  Nayarit: "18",
  "Nuevo León": "19",
  Oaxaca: "20",
  Puebla: "21",
  Querétaro: "22",
  "Quintana Roo": "23",
  "San Luis Potosí": "24",
  Sinaloa: "25",
  Sonora: "26",
  Tabasco: "27",
  Tamaulipas: "28",
  Tlaxcala: "29",
  Veracruz: "30",
  Yucatán: "31",
  Zacatecas: "32",
};

function requireCondition(ok: boolean, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
function near(a: number, b: number) {
  return Math.abs(a - b) < 0.000002;
}
export function validateData() {
  const expected = Array.from({ length: 32 }, (_, i) => String(i + 1).padStart(2, "0"));
  function coverage(keys: string[]) {
    requireCondition(
      keys.length === 32 && new Set(keys).size === 32 && expected.every((k) => keys.includes(k)),
      "Cobertura territorial inválida",
    );
  }
  coverage(STATES.map((s) => mapCodes[s.n]!));
  coverage(risks.map((r) => r.entidad_clave));
  coverage(projections.map((r) => r.entidad_clave));
  requireCondition(years.join() === "2009,2012,2015,2018,2021,2024", "Serie histórica incompleta");
  for (const year of years)
    coverage(history.filter((r) => r.anio === year).map((r) => r.entidad_clave));
  for (const r of history) {
    requireCondition(
      r.lista_nominal === r.si_votaron + r.no_votaron + r.no_especificados &&
        r.conocidos === r.si_votaron + r.no_votaron,
      "Identidad contable inválida",
    );
    if (r.participacion !== null)
      requireCondition(
        r.conocidos > 0 && near(r.participacion, r.si_votaron / r.conocidos),
        "Participación inconsistente",
      );
    if (r.abstencion !== null)
      requireCondition(
        r.conocidos > 0 && near(r.abstencion, r.no_votaron / r.conocidos),
        "Abstención inconsistente",
      );
  }
  for (const r of risks) {
    requireCondition(
      r.umbral_bajo_pct === thresholds[0] &&
        r.umbral_medio_pct === thresholds[1] &&
        classify(r.abstencion_referencia_pct) === r.riesgo_relativo,
      "Semáforo inconsistente",
    );
    requireCondition(
      near(
        projections.find((p) => p.entidad_clave === r.entidad_clave)!.abstencion_referencia_pct,
        r.abstencion_referencia_pct,
      ),
      "Proyección no coincide",
    );
    const past = history.find((p) => p.anio === 2021 && p.entidad_clave === r.entidad_clave)!;
    requireCondition(
      past.abstencion !== null &&
        near(
          past.abstencion * 100,
          projections.find((p) => p.entidad_clave === r.entidad_clave)!.abstencion_2021_pct,
        ),
      "Comparación histórica no corresponde a 2021",
    );
  }
  const fit = mlMetadata.entrenamiento_final;
  requireCondition(
    fit.features.join() === mlMetadata.features.join() &&
      fit.mean.length === fit.features.length &&
      fit.scale.length === fit.features.length &&
      fit.beta.length === fit.features.length + 1 &&
      fit.train_years.join() === "2015,2018,2021,2024" &&
      fit.n_train === 128 &&
      fit.alpha === 10,
    "Entrenamiento Ridge inválido",
  );
  for (const p of projections) {
    const x = mlMetadata.caracteristicas_2027.find((row) => row.entidad_clave === p.entidad_clave)!;
    requireCondition(
      !!x && x.max_anio_fuente === 2024 && x.anio_mismo_tipo === 2021,
      "Fuentes de características inválidas",
    );
    const residual =
      fit.beta[0]! +
      fit.features.reduce(
        (sum, name, i) =>
          sum +
          (((x as unknown as Record<string, number>)[name]! - fit.mean[i]!) / fit.scale[i]!) *
            fit.beta[i + 1]!,
        0,
      );
    requireCondition(
      near(residual, p.residual_estimado_pp) &&
        near(p.abstencion_2021_pct + residual, p.prediccion_sin_limitar_pct) &&
        near(
          p.abstencion_referencia_pct,
          Math.max(0, Math.min(100, p.prediccion_sin_limitar_pct)),
        ) &&
        near(p.diferencia_2021_2027_pp, p.abstencion_referencia_pct - p.abstencion_2021_pct),
      "La estimación no reproduce el modelo Ridge",
    );
  }
  const sorted = projections.map((p) => p.abstencion_referencia_pct).sort((a, b) => a - b);
  for (const [i, fraction] of [1 / 3, 2 / 3].entries()) {
    const pos = (sorted.length - 1) * fraction,
      lo = Math.floor(pos);
    requireCondition(
      near(thresholds[i]!, sorted[lo]! + (sorted[Math.ceil(pos)]! - sorted[lo]!) * (pos - lo)),
      "Terciles ML inconsistentes",
    );
  }
  const assumptions = [0, ...reductions];
  requireCondition(
    new Set(nationals.map((r) => r.reduccion_supuesta_pp)).size === assumptions.length &&
      nationals.length === assumptions.length,
    "Resumen nacional duplicado/incompleto",
  );
  for (const reduction of assumptions) {
    const group = scenarios.filter((r) => r.reduccion_supuesta_pp === reduction);
    coverage(group.map((r) => r.entidad_clave));
    const total = group.reduce((sum, r) => sum + r.conocidos_2021, 0);
    for (const r of group) {
      const base = risks.find((x) => x.entidad_clave === r.entidad_clave)!;
      const past = history.find((x) => x.anio === 2021 && x.entidad_clave === r.entidad_clave)!;
      requireCondition(
        r.conocidos_2021 === past.conocidos && near(r.peso_nacional, r.conocidos_2021 / total),
        "Pesos inválidos",
      );
      requireCondition(
        near(r.abstencion_referencia_pct, base.abstencion_referencia_pct) &&
          near(
            r.abstencion_escenario_pct,
            Math.max(0, base.abstencion_referencia_pct - reduction),
          ) &&
          near(r.participacion_escenario_pct + r.abstencion_escenario_pct, 100) &&
          near(
            r.reduccion_efectiva_pp,
            base.abstencion_referencia_pct - r.abstencion_escenario_pct,
          ),
        "Escenario inconsistente",
      );
      requireCondition(
        r.escenario === (reduction === 0 ? "sin_intervencion" : "con_intervencion"),
        "Tipo de escenario inválido",
      );
    }
    const national = nationals.find((r) => r.reduccion_supuesta_pp === reduction);
    requireCondition(
      !!national &&
        national.denominador_conocidos_2021 === total &&
        near(
          national.abstencion_nacional_pct,
          group.reduce((sum, r) => sum + r.conocidos_2021 * r.abstencion_escenario_pct, 0) / total,
        ) &&
        near(national.abstencion_nacional_pct + national.participacion_nacional_pct, 100),
      "Ponderación nacional inconsistente",
    );
  }
}
validateData();

export function historical(year: number, entity?: string): HistoryRow | undefined {
  if (entity) return history.find((r) => r.anio === year && r.entidad_clave === entity);
  const rows = history.filter((r) => r.anio === year);
  if (!rows.length) return;
  const sum = (
    key: "lista_nominal" | "si_votaron" | "no_votaron" | "no_especificados" | "conocidos",
  ) => rows.reduce((n, r) => n + r[key], 0);
  const known = sum("conocidos");
  return {
    anio: year,
    entidad_clave: "00",
    entidad_nombre: "México · Nacional",
    lista_nominal: sum("lista_nominal"),
    si_votaron: sum("si_votaron"),
    no_votaron: sum("no_votaron"),
    no_especificados: sum("no_especificados"),
    conocidos: known,
    participacion: known ? sum("si_votaron") / known : null,
    abstencion: known ? sum("no_votaron") / known : null,
  };
}
export function scenarioValue(reduction: number, entity?: string) {
  return entity
    ? scenarios.find((r) => r.entidad_clave === entity && r.reduccion_supuesta_pp === reduction)
        ?.abstencion_escenario_pct
    : nationals.find((r) => r.reduccion_supuesta_pp === reduction)?.abstencion_nacional_pct;
}
export type Layer = "history" | "risk" | "baseline" | "intervention" | "change";
export function territory(name: string, layer: Layer, year: number, reduction: number) {
  const entity = mapCodes[name];
  const observed = entity ? historical(year, entity)?.participacion : null;
  const value =
    layer === "change"
      ? projections.find((p) => p.entidad_clave === entity)?.diferencia_2021_2027_pp
      : layer === "history"
        ? observed == null
          ? null
          : observed * 100
        : entity
          ? scenarioValue(layer === "intervention" ? reduction : 0, entity)
          : null;
  const category = layer === "history" || layer === "change" ? null : classify(value);
  const color =
    value == null
      ? colors.missing
      : layer === "change"
        ? value === 0
          ? "#f5f2fa"
          : `hsl(${value < 0 ? 251 : 320}, 38%, ${96 - Math.min(1, Math.abs(value) / changeDomain) * 58}%)`
        : layer === "history"
          ? `hsl(276, 48%, ${94 - ((value - historyDomain[0]) / (historyDomain[1] - historyDomain[0])) * 57}%)`
          : colors[category!];
  const label =
    layer === "history"
      ? `Participación observada ${year}`
      : layer === "intervention"
        ? `Abstención simulada 2027 (−${reduction} pp)`
        : "Abstención ML experimental 2027";
  return {
    value,
    category,
    color,
    label:
      layer === "change"
        ? `${name} · Cambio estimado 2021–2027: ${value == null ? "No disponible" : `${value > 0 ? "+" : ""}${value.toFixed(2)} pp`} · 2021: ${percent(projections.find((p) => p.entidad_clave === entity)?.abstencion_2021_pct)} · ML 2027: ${percent(scenarioValue(0, entity))}`
        : `${name} · ${label}: ${percent(value)}${category ? ` · Riesgo relativo ${category}` : ""}`,
  };
}

export const electionType = (year: number) =>
  [2012, 2018, 2024].includes(year) ? "Presidencial" : "Intermedia";
export const historyDomain = [
  Math.min(...history.flatMap((r) => (r.participacion == null ? [] : [r.participacion * 100]))),
  Math.max(...history.flatMap((r) => (r.participacion == null ? [] : [r.participacion * 100]))),
] as const;

export const changeDomain = Math.max(
  ...projections.map((p) => Math.abs(p.diferencia_2021_2027_pp)),
);
