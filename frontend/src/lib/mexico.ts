import raw from "./mx-states.json";

export type StateData = { n: string; t: "Polygon" | "MultiPolygon"; c: unknown };

const rename: Record<string, string> = {
  "Distrito Federal": "Ciudad de México",
  "Michoacán de Ocampo": "Michoacán",
  "Veracruz de Ignacio de la Llave": "Veracruz",
  "Coahuila de Zaragoza": "Coahuila",
};

export const STATES: StateData[] = (raw as StateData[]).map((s) => ({
  ...s,
  n: rename[s.n] ?? s.n,
}));

export function toFeature(s: StateData) {
  return {
    type: "Feature" as const,
    properties: { name: s.n },
    geometry: { type: s.t, coordinates: s.c } as GeoJSON.Geometry,
  };
}
