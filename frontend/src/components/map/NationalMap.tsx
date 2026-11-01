import { useMemo } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { STATES, toFeature, type StateData } from "@/lib/mexico";

interface Props {
  selected: string | null;
  states?: StateData[];
  hideWhenSelected?: boolean;
  appearance?: (name: string) => { color: string; label: string };
  onSelect: (name: string) => void;
  onHover: (name: string | null) => void;
}

export function NationalMap({
  selected,
  onSelect,
  onHover,
  appearance,
  hideWhenSelected = true,
  states = STATES,
}: Props) {
  const features = useMemo(() => states.map(toFeature), [states]);
  const path = useMemo(
    () =>
      geoPath(
        geoMercator().fitSize([900, 620], {
          type: "FeatureCollection",
          features,
        } as GeoJSON.FeatureCollection),
      ),
    [features],
  );
  return (
    <svg
      viewBox="0 0 900 620"
      aria-label="Entidades federativas de México"
      className={`national-map ${selected && hideWhenSelected ? "national-map-muted" : ""}`}
      aria-hidden={!!selected && hideWhenSelected}
    >
      {features.map((feature) => (
        <path
          key={feature.properties.name}
          d={path(feature) ?? ""}
          className="state-path"
          style={appearance ? { fill: appearance(feature.properties.name).color } : undefined}
          role="button"
          tabIndex={selected && hideWhenSelected ? -1 : 0}
          aria-label={
            appearance
              ? appearance(feature.properties.name).label
              : `Explorar ${feature.properties.name}`
          }
          aria-pressed={selected === feature.properties.name}
          data-active={selected === feature.properties.name}
          onMouseEnter={() => onHover(feature.properties.name)}
          onMouseLeave={() => onHover(null)}
          onFocus={() => onHover(feature.properties.name)}
          onBlur={() => onHover(null)}
          onClick={() => onSelect(feature.properties.name)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelect(feature.properties.name);
            }
          }}
        >
          <title>
            {appearance ? appearance(feature.properties.name).label : feature.properties.name}
          </title>
        </path>
      ))}
    </svg>
  );
}
