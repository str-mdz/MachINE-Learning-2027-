import { historical, mlMetadata, projections, risks, scenarioValue } from "./electoral-data";

export const featureNames: Record<string, string> = {
  brecha_previa_pp: "Brecha entre elecciones anteriores",
  presidencial: "Tipo de elección",
  ns_previo: "Registros no especificados",
  log_ln_previa: "Logaritmo de lista nominal",
  prop_joven_previa: "Proporción de jóvenes",
  prop_mayor_previa: "Proporción de personas mayores",
  prop_mujeres_previa: "Proporción de mujeres",
};

export function contributions(entity: string) {
  const fit = mlMetadata.entrenamiento_final;
  const row = mlMetadata.caracteristicas_2027.find((r) => r.entidad_clave === entity);
  if (!row) return undefined;
  const terms = fit.features.map((name, i) => ({
    name,
    label: featureNames[name] ?? name,
    value:
      (((row as unknown as Record<string, number>)[name]! - fit.mean[i]!) / fit.scale[i]!) *
      fit.beta[i + 1]!,
  }));
  return {
    terms,
    intercept: fit.beta[0]!,
    residual: fit.beta[0]! + terms.reduce((sum, term) => sum + term.value, 0),
  };
}

export function resultsCsv(scope: "all" | "national" | string) {
  const header = [
    "entidad_clave",
    "entidad_nombre",
    "abstencion_2021_pct",
    "ridge_2027_pct",
    "diferencia_pp",
    "riesgo_relativo",
    "escenario_base_pct",
    "escenario_1pp_pct",
    "escenario_3pp_pct",
    "escenario_5pp_pct",
  ];
  const rows =
    scope === "national"
      ? [
          [
            "00",
            "México nacional",
            historical(2021)!.abstencion! * 100,
            scenarioValue(0)!,
            scenarioValue(0)! - historical(2021)!.abstencion! * 100,
            "No aplica",
            ...[0, 1, 3, 5].map((r) => scenarioValue(r)!),
          ],
        ]
      : projections
          .filter((p) => scope === "all" || p.entidad_clave === scope)
          .map((p) => [
            p.entidad_clave,
            p.entidad_nombre,
            p.abstencion_2021_pct,
            p.abstencion_referencia_pct,
            p.diferencia_2021_2027_pp,
            risks.find((r) => r.entidad_clave === p.entidad_clave)!.riesgo_relativo,
            ...[0, 1, 3, 5].map((r) => scenarioValue(r, p.entidad_clave)!),
          ]);
  return (
    "\uFEFF" +
    [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\r\n") +
    "\r\n"
  );
}

export function downloadResults(scope: string) {
  const url = URL.createObjectURL(
    new Blob([resultsCsv(scope)], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `MachINE2027_${scope === "all" ? "32_entidades" : scope === "national" ? "nacional" : scope}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
