export interface DemographicRecord {
  anio: number;
  entidad_clave: string;
  edad: number | null;
  edad_revision: boolean;
  sexo: string;
  si_votaron: number;
  no_votaron: number;
}
const sexes: Record<string, string> = {
  hombres: "Hombres",
  mujeres: "Mujeres",
  no_binario: "No binario",
};
export function demographicGroups(data: DemographicRecord[], year: number, entity?: string) {
  const groups = new Map<
    string,
    { label: string; yes: number; no: number; known: number; rate: number | null }
  >();
  for (const r of data) {
    if (
      r.anio !== year ||
      (entity && r.entidad_clave !== entity) ||
      r.edad == null ||
      r.edad_revision ||
      r.edad < 18 ||
      r.edad > 120 ||
      !sexes[r.sexo] ||
      !Number.isSafeInteger(r.si_votaron) ||
      !Number.isSafeInteger(r.no_votaron) ||
      r.si_votaron < 0 ||
      r.no_votaron < 0
    )
      continue;
    const band =
      r.edad < 30
        ? "18–29 años"
        : r.edad < 45
          ? "30–44 años"
          : r.edad < 60
            ? "45–59 años"
            : "60 años o más";
    const label = sexes[r.sexo] + " · " + band;
    const g = groups.get(label) ?? { label, yes: 0, no: 0, known: 0, rate: null };
    g.yes += r.si_votaron;
    g.no += r.no_votaron;
    groups.set(label, g);
  }
  return [...groups.values()]
    .filter((g) => g.yes + g.no > 0)
    .map((g) => ({ ...g, known: g.yes + g.no, rate: (100 * g.no) / (g.yes + g.no) }));
}
