import * as THREE from "three";
export function surfaceAnchor(shapes: THREE.Shape[]): [number, number, number] {
  let best = 0;
  let anchor: [number, number, number] | null = null;
  for (const shape of shapes) {
    const geometry = new THREE.ShapeGeometry(shape);
    const vertices = geometry.getAttribute("position");
    const indices = geometry.index;
    if (indices)
      for (let t = 0; t < indices.count; t += 3) {
        const i = indices.getX(t),
          j = indices.getX(t + 1),
          k = indices.getX(t + 2);
        const ax = vertices.getX(i),
          ay = vertices.getY(i),
          bx = vertices.getX(j),
          by = vertices.getY(j),
          cx = vertices.getX(k),
          cy = vertices.getY(k);
        const area = Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
        if (area > best) {
          best = area;
          anchor = [(ax + bx + cx) / 3, (ay + by + cy) / 3, 0.17];
        }
      }
    geometry.dispose();
  }
  return anchor ?? [0, 0, 0.17];
}
export function labelPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  labelWidth: number,
  labelHeight: number,
) {
  return {
    left: Math.max(8, Math.min(width - labelWidth - 8, x + 25)) - x,
    top: Math.max(64, Math.min(height - labelHeight - 8, y - labelHeight - 55)) - y,
  };
}
