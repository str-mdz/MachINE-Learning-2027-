import { surfaceAnchor, labelPosition } from "@/lib/map/annotation";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls, ContactShadows } from "@react-three/drei";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { buildShapes } from "@/lib/map/geometry";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { StateData } from "@/lib/mexico";

type LabelRefs = {
  root: RefObject<HTMLDivElement | null>;
  box: RefObject<HTMLDivElement | null>;
  line: RefObject<SVGPathElement | null>;
};
function Land({
  state,
  color,
  labelRefs,
}: {
  state: StateData;
  color: string;
  labelRefs: LabelRefs;
}) {
  const reducedMotion = useReducedMotion();
  const g = useRef<THREE.Group>(null);
  const t = useRef(0);
  const shapes = useMemo(() => buildShapes(state), [state]);
  const grass = useMemo(
    () =>
      new THREE.ExtrudeGeometry(shapes, {
        depth: 0.12,
        bevelEnabled: true,
        bevelSize: 0.03,
        bevelThickness: 0.03,
        bevelSegments: 2,
      }),
    [shapes],
  );
  const soil = useMemo(
    () => new THREE.ExtrudeGeometry(shapes, { depth: 0.9, bevelEnabled: false }),
    [shapes],
  );
  const rock = useMemo(
    () => new THREE.ExtrudeGeometry(shapes, { depth: 0.35, bevelEnabled: false }),
    [shapes],
  );

  useFrame((_, d) => {
    if (reducedMotion && g.current) {
      g.current.position.y = 0;
      g.current.scale.setScalar(1);
      g.current.rotation.y = 0;
      return;
    }
    t.current += Math.min(d, 0.05);
    if (!g.current) return;
    const p = Math.min(t.current / 1.4, 1);
    const e = 1 - Math.pow(1 - p, 3);
    g.current.position.y = -3 + e * 3 + Math.sin(t.current * 1.4) * 0.08 * e;
    g.current.scale.setScalar(0.4 + 0.6 * e);
    g.current.rotation.y = (1 - e) * -1.2 + Math.sin(t.current * 0.4) * 0.15;
  });

  const anchor = useMemo(() => surfaceAnchor(shapes), [shapes]);
  return (
    <group ref={g}>
      <group rotation-x={-Math.PI / 2}>
        <mesh geometry={rock} position-z={-1.25} castShadow>
          <meshStandardMaterial color="#5b4636" roughness={1} flatShading />
        </mesh>
        <mesh geometry={soil} position-z={-0.9} castShadow>
          <meshStandardMaterial color="#9a5b34" roughness={0.95} />
        </mesh>
        <mesh geometry={grass} castShadow receiveShadow>
          <meshStandardMaterial
            color={color}
            roughness={0.7}
            emissive={color}
            emissiveIntensity={0.08}
          />
        </mesh>
        <SurfaceLabel anchor={anchor} labelRefs={labelRefs} />
      </group>
    </group>
  );
}

function SurfaceLabel({
  anchor,
  labelRefs,
}: {
  anchor: [number, number, number];
  labelRefs: LabelRefs;
}) {
  const group = useRef<THREE.Group>(null);
  const point = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    const { root, box, line } = labelRefs;
    if (!group.current || !root.current || !box.current || !line.current) return;
    group.current.getWorldPosition(point);
    point.project(camera);
    const x = ((point.x + 1) * size.width) / 2,
      y = ((1 - point.y) * size.height) / 2;
    root.current.style.visibility = point.z < -1 || point.z > 1 ? "hidden" : "visible";
    root.current.style.transform = `translate(${x}px,${y}px)`;
    const pos = labelPosition(
      x,
      y,
      size.width,
      size.height,
      box.current.offsetWidth,
      box.current.offsetHeight,
    );
    box.current.style.left = `${pos.left}px`;
    box.current.style.top = `${pos.top}px`;
    line.current.setAttribute("d", `M0 0 L${pos.left + 10} ${pos.top + box.current.offsetHeight}`);
  });
  return <group ref={group} position={anchor} />;
}

export default function State3D({
  state,
  color = "#5f8f4e",
  indicator = "No disponible",
}: {
  state: StateData;
  color?: string;
  indicator?: string;
}) {
  const labelRoot = useRef<HTMLDivElement>(null);
  const labelBox = useRef<HTMLDivElement>(null);
  const labelLine = useRef<SVGPathElement>(null);
  const labelRefs = { root: labelRoot, box: labelBox, line: labelLine };
  return (
    <>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 5, 7], fov: 40 }}>
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[5, 8, 4]}
          intensity={1.6}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <Environment>
          <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} />
          <Lightformer
            intensity={1}
            color="#f3c9a0"
            position={[-5, 1, -1]}
            rotation-y={Math.PI / 2}
            scale={[20, 1, 1]}
          />
        </Environment>
        <Land key={state.n} state={state} color={color} labelRefs={labelRefs} />
        <ContactShadows position={[0, -2, 0]} opacity={0.45} scale={14} blur={2.6} far={4} />
        <OrbitControls enablePan={false} minDistance={4} maxDistance={14} />
      </Canvas>
      <div
        ref={labelRoot}
        className="surface-annotation"
        style={{ position: "absolute", left: 0, top: 0, zIndex: 5, visibility: "hidden" }}
      >
        <svg width="1" height="1" aria-hidden="true">
          <path ref={labelLine} />
          <circle r="3" />
        </svg>
        <div ref={labelBox} className="surface-label">
          <strong>{state.n}</strong>
          <span>{indicator}</span>
        </div>
      </div>
    </>
  );
}
