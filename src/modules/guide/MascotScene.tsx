/**
 * Pulse in 3D. One canvas for the whole app: the overlay moves it between the dock and the cursor.
 * Each pose is its own GLB with a looping 2 s clip (public/models/mascot-*.glb). The scenes are
 * cloned so the assistant page's astronaut can use the same cached models at the same time.
 */
import { useAnimations, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Box3, Vector3, type Group } from "three";
import type { MascotPose } from "./guideStore";
import { POSE_URLS } from "./mascotModels";
import { motion } from "./motion";


const MODEL_HEIGHT = 1.8;
const SPIN_MS = 900;

function Model({ pose, visible, onReady }: { pose: MascotPose; visible: boolean; onReady: (p: MascotPose) => void }) {
  const { scene, animations } = useGLTF(POSE_URLS[pose]);
  const copy = useMemo(() => scene.clone(true), [scene]);
  const group = useRef<Group>(null);
  const { actions } = useAnimations(animations, group);

  const fit = useMemo(() => {
    const box = new Box3().setFromObject(copy);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const scale = size.y > 0 ? MODEL_HEIGHT / size.y : 1;
    return { scale, position: [-center.x * scale, -center.y * scale, -center.z * scale] as [number, number, number] };
  }, [copy]);

  useEffect(() => {
    const action = Object.values(actions)[0];
    action?.reset().play();
    onReady(pose);
    return () => {
      action?.stop();
    };
  }, [actions, onReady, pose]);

  return (
    <group ref={group} visible={visible} scale={fit.scale} position={fit.position}>
      <primitive object={copy} />
    </group>
  );
}

/** Gentle float, and a full spin while Pulse flies between the dock and the cursor. */
function Body({ children }: { children: React.ReactNode }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.getElapsedTime();
    g.position.y = Math.sin(t * 1.7) * 0.05;
    g.rotation.z = Math.sin(t * 0.9) * 0.04;
    const since = performance.now() - motion.spinAt;
    g.rotation.y = motion.spinAt && since < SPIN_MS ? (since / SPIN_MS) * Math.PI * 2 : 0;
  });
  return <group ref={ref}>{children}</group>;
}

export default function MascotScene({ pose }: { pose: MascotPose }) {
  // Poses mount the first time they are asked for, then stay mounted so switching is instant.
  const [wanted, setWanted] = useState<MascotPose[]>([pose]);
  const [ready, setReady] = useState<MascotPose[]>([]);
  if (!wanted.includes(pose)) setWanted([...wanted, pose]);
  const markReady = useMemo(() => (p: MascotPose) => setReady((r) => (r.includes(p) ? r : [...r, p])), []);
  const shown = ready.includes(pose) ? pose : (ready.at(-1) ?? pose);

  return (
    <Canvas camera={{ position: [0, 0.1, 3.7], fov: 32 }} dpr={[1, 2]} gl={{ alpha: true, antialias: true }}>
      <hemisphereLight args={["#ffffff", "#c9d3e6", 1.1]} />
      <directionalLight position={[2.5, 4, 3]} intensity={2} />
      <directionalLight position={[-3, 1.5, -2]} intensity={0.6} />
      <Body>
        {wanted.map((p) => (
          <Suspense key={p} fallback={null}>
            <Model pose={p} visible={p === shown} onReady={markReady} />
          </Suspense>
        ))}
      </Body>
    </Canvas>
  );
}
