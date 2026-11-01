import * as THREE from "three";
import type { StateData } from "@/lib/mexico";

export function buildShapes(state: StateData) {
  const polygons: number[][][][] =
    state.t === "Polygon" ? [state.c as number[][][]] : (state.c as number[][][][]);
  const coordinates = polygons.flat(2);
  const longitudes = coordinates.map((coordinate) => coordinate[0]!);
  const latitudes = coordinates.map((coordinate) => coordinate[1]!);
  const centerLatitude = (Math.min(...latitudes) + Math.max(...latitudes)) / 2;
  const longitudeCorrection = Math.cos((centerLatitude * Math.PI) / 180);
  const centerX = ((Math.min(...longitudes) + Math.max(...longitudes)) / 2) * longitudeCorrection;
  const centerY = centerLatitude;
  const largestSpan = Math.max(
    (Math.max(...longitudes) - Math.min(...longitudes)) * longitudeCorrection,
    Math.max(...latitudes) - Math.min(...latitudes),
  );
  const scale = 5 / largestSpan;
  const projectPoint = (coordinate: number[]) =>
    new THREE.Vector2(
      (coordinate[0]! * longitudeCorrection - centerX) * scale,
      (coordinate[1]! - centerY) * scale,
    );
  return polygons.map((polygon) => {
    const shape = new THREE.Shape(polygon[0]!.map(projectPoint));
    polygon.slice(1).forEach((hole) => shape.holes.push(new THREE.Path(hole.map(projectPoint))));
    return shape;
  });
}
