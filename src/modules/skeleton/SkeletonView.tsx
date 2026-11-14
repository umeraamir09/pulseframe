import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { useState } from "react";
import { SKELETON_REGIONS, type SkeletonRegionId } from "../../contracts";

const LAYOUT: Record<SkeletonRegionId, [number, number, number, number, number, number]> = {
  // x, y, z, w, h, d — placeholder boxes until a licensed GLB lands
  head: [0, 1.55, 0, 0.28, 0.28, 0.28],
  chest: [0, 1.15, 0, 0.5, 0.4, 0.28],
  abdomen: [0, 0.78, 0, 0.42, 0.32, 0.26],
  spine: [0, 1.05, -0.14, 0.1, 0.7, 0.1],
  leftArm: [-0.42, 1.05, 0, 0.14, 0.55, 0.14],
  rightArm: [0.42, 1.05, 0, 0.14, 0.55, 0.14],
  leftLeg: [-0.16, 0.3, 0, 0.16, 0.7, 0.16],
  rightLeg: [0.16, 0.3, 0, 0.16, 0.7, 0.16],
  skin: [0, 0.9, 0, 0.05, 0.05, 0.05],
};

function RegionBox({
  id,
  selected,
  onSelect,
}: {
  id: SkeletonRegionId;
  selected: boolean;
  onSelect: (id: SkeletonRegionId) => void;
}) {
  const [x, y, z, w, h, d] = LAYOUT[id];
  if (id === "skin") return null;
  return (
    <mesh position={[x, y, z]} onClick={(e) => (e.stopPropagation(), onSelect(id))}>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={selected ? "#ff6b4a" : "#d7c4a3"} />
    </mesh>
  );
}

export function SkeletonView({
  selected,
  onSelect,
}: {
  selected?: SkeletonRegionId[];
  onSelect?: (id: SkeletonRegionId) => void;
}) {
  const [local, setLocal] = useState<SkeletonRegionId | undefined>(selected?.[0]);
  const active = selected ?? (local ? [local] : []);
  const handle = (id: SkeletonRegionId) => {
    setLocal(id);
    onSelect?.(id);
  };

  return (
    <div className="skeleton-stage">
      <Canvas camera={{ position: [1.6, 1.2, 2.2], fov: 45 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 5, 2]} intensity={1.1} />
        {SKELETON_REGIONS.map((id) => (
          <RegionBox key={id} id={id} selected={active.includes(id)} onSelect={handle} />
        ))}
        <OrbitControls />
        {local ? (
          <Html position={[0, 1.9, 0]} center>
            <div className="tag">{local}</div>
          </Html>
        ) : null}
      </Canvas>
      <p className="muted">Placeholder regions. Swap in a credited GLB in this module (Dev A).</p>
    </div>
  );
}
