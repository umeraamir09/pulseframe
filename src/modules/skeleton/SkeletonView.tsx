import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Box3, Mesh, Vector3, type BufferGeometry } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { SKELETON_REGIONS, type SkeletonRegionId } from "../../contracts";
import { REGION_LABELS, isSkeletonRegionId } from "./regions";

// Blender Human Base Meshes (CC0), split into one mesh per region with userData.regionId.
// Y-up, metres, feet at y = 0, faces +Z. Meshopt-compressed; drei decodes it locally.
const MODEL_URL = "/models/pulseframe-body.glb";
const USE_DRACO = false;
const USE_MESHOPT = true;

const COLORS = {
  base: "#cfd3da",
  hover: "#dce9fd",
  selected: "#ff6b4a",
  selectedHover: "#ff8a6e",
  flagged: "#f2b84b",
  flaggedHover: "#f7cb73",
};

// Body is 1.684 m tall; aim a little below mid-height so head and feet both fit.
const TARGET: [number, number, number] = [0, 0.88, 0];
const CAMERA_PRESETS: Record<"front" | "back", [number, number, number]> = {
  front: [0, 1.0, 2.45],
  back: [0, 1.0, -2.45],
};

// Ignore clicks that end an orbit drag (pixels between pointer down and up).
const CLICK_DRAG_TOLERANCE = 5;

type RegionMesh = { id: SkeletonRegionId; geometry: BufferGeometry; labelAt: [number, number, number] };

function useRegionMeshes(): RegionMesh[] {
  const { nodes } = useGLTF(MODEL_URL, USE_DRACO, USE_MESHOPT);
  return useMemo(() => {
    const found = new Map<SkeletonRegionId, BufferGeometry>();
    for (const node of Object.values(nodes)) {
      const id: unknown = node.userData.regionId;
      if (node instanceof Mesh && isSkeletonRegionId(id)) found.set(id, node.geometry);
    }
    return SKELETON_REGIONS.flatMap((id) => {
      const geometry = found.get(id);
      if (!geometry) return [];
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const box = geometry.boundingBox ?? new Box3();
      const center = box.getCenter(new Vector3());
      return [{ id, geometry, labelAt: [center.x, box.max.y + 0.06, center.z] as [number, number, number] }];
    });
  }, [nodes]);
}

function regionColor(selected: boolean, flagged: boolean, hovered: boolean) {
  if (selected) return hovered ? COLORS.selectedHover : COLORS.selected;
  if (flagged) return hovered ? COLORS.flaggedHover : COLORS.flagged;
  return hovered ? COLORS.hover : COLORS.base;
}

function Body({
  selected,
  flagged,
  readOnly,
  onToggle,
}: {
  selected: SkeletonRegionId[];
  flagged: SkeletonRegionId[];
  readOnly: boolean;
  onToggle?: (id: SkeletonRegionId) => void;
}) {
  const regions = useRegionMeshes();
  const [hovered, setHovered] = useState<SkeletonRegionId | null>(null);
  const interactive = !readOnly;

  useEffect(() => {
    document.body.style.cursor = interactive && hovered ? "pointer" : "";
  }, [hovered, interactive]);
  useEffect(() => () => void (document.body.style.cursor = ""), []);

  const over = (id: SkeletonRegionId) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(id);
  };
  const out = (id: SkeletonRegionId) => () => setHovered((h) => (h === id ? null : h));
  const click = (id: SkeletonRegionId) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > CLICK_DRAG_TOLERANCE) return;
    onToggle?.(id);
  };

  return (
    <group>
      {regions.map(({ id, geometry, labelAt }) => (
        <group key={id}>
          <mesh
            geometry={geometry}
            onPointerOver={interactive ? over(id) : undefined}
            onPointerOut={interactive ? out(id) : undefined}
            onClick={interactive ? click(id) : undefined}
          >
            {/* One material instance per region; the cached GLB materials are never mutated. */}
            <meshStandardMaterial
              color={regionColor(selected.includes(id), flagged.includes(id), interactive && hovered === id)}
              roughness={0.6}
              metalness={0}
            />
          </mesh>
          {selected.includes(id) ? (
            <Html position={labelAt} center className="region-label" zIndexRange={[20, 0]}>
              <div className="tag">{REGION_LABELS[id]}</div>
            </Html>
          ) : null}
        </group>
      ))}
      <ContactShadows position={[0, 0.001, 0]} opacity={0.35} scale={2.4} blur={2.4} far={1.2} frames={1} />
    </group>
  );
}

function LoadingBody() {
  return (
    <Html center>
      <div className="tag">Loading body model…</div>
    </Html>
  );
}

function StudioLights() {
  return (
    <>
      <hemisphereLight args={["#ffffff", "#aeb8c6", 0.9]} />
      <ambientLight intensity={0.2} />
      {/* Key: upper-left front (viewer's left is -X). */}
      <directionalLight position={[-2.2, 3.4, 2.8]} intensity={2.1} />
      {/* Soft fill from the right. */}
      <directionalLight position={[2.6, 1.6, 2]} intensity={0.45} />
      {/* Dim rim from behind to separate the silhouette. */}
      <directionalLight position={[1.2, 2.6, -3]} intensity={0.9} />
    </>
  );
}

export function SkeletonView({
  selected,
  onToggle,
  flagged = [],
  readOnly = false,
}: {
  selected: SkeletonRegionId[];
  onToggle?: (id: SkeletonRegionId) => void;
  flagged?: SkeletonRegionId[];
  readOnly?: boolean;
}) {
  const controls = useRef<OrbitControlsImpl>(null);

  const setView = (preset: keyof typeof CAMERA_PRESETS) => {
    const c = controls.current;
    if (!c) return;
    c.object.position.set(...CAMERA_PRESETS[preset]);
    c.target.set(...TARGET);
    c.update();
  };

  return (
    <div className="skeleton-view">
      <div className="skeleton-stage">
        <Canvas camera={{ position: CAMERA_PRESETS.front, fov: 45 }} dpr={[1, 2]}>
          <StudioLights />
          <Suspense fallback={<LoadingBody />}>
            <Body selected={selected} flagged={flagged} readOnly={readOnly} onToggle={onToggle} />
          </Suspense>
          <OrbitControls ref={controls} target={TARGET} enablePan={false} minDistance={1.2} maxDistance={5} />
        </Canvas>
        <div className="camera-presets" role="group" aria-label="Camera view">
          <button type="button" onClick={() => setView("front")}>
            Front
          </button>
          <button type="button" onClick={() => setView("back")}>
            Back
          </button>
        </div>
      </div>
      <div className="region-buttons" role="group" aria-label="Body regions">
        {SKELETON_REGIONS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={selected.includes(id)}
            className={flagged.includes(id) ? "flagged" : undefined}
            disabled={readOnly}
            onClick={() => onToggle?.(id)}
          >
            {REGION_LABELS[id]}
          </button>
        ))}
      </div>
      <p className="muted small">
        Click regions on the body or use the buttons. You can select more than one. Drag to rotate.
      </p>
    </div>
  );
}

useGLTF.preload(MODEL_URL, USE_DRACO, USE_MESHOPT);
