/**
 * The animated 3D astronaut beside the assistant chat. Lazy-loaded by
 * AstronautAvatar, so three.js work starts only when the avatar is on screen.
 * Models: public/models/mascot-*.glb (scripts/blender/astronaut_mascot.py), one 2 s loop each.
 */
import { useAnimations, useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Box3, Vector3, type Group } from "three";

export type AstronautPose = "wave" | "type" | "point";

const POSE_URLS: Record<AstronautPose, string> = {
  wave: "/models/mascot-wave.glb",
  type: "/models/mascot-type.glb",
  point: "/models/mascot-point.glb",
};

/** World height the model is scaled to; the camera below frames it. */
const MODEL_HEIGHT = 1.8;

function Mascot({ pose }: { pose: AstronautPose }) {
  const { scene, animations } = useGLTF(POSE_URLS[pose]);
  const group = useRef<Group>(null);
  const { actions } = useAnimations(animations, group);

  const fit = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const scale = size.y > 0 ? MODEL_HEIGHT / size.y : 1;
    return { scale, position: [-center.x * scale, -center.y * scale, -center.z * scale] as [number, number, number] };
  }, [scene]);

  useEffect(() => {
    const action = Object.values(actions)[0];
    action?.reset().fadeIn(0.25).play();
    return () => {
      action?.fadeOut(0.25);
    };
  }, [actions]);

  return (
    <group ref={group} scale={fit.scale} position={fit.position}>
      <primitive object={scene} />
    </group>
  );
}

export default function AstronautScene({ pose }: { pose: AstronautPose }) {
  // The first question always shows the typing pose; fetch it while the crew reads the greeting.
  useEffect(() => {
    const timer = window.setTimeout(() => useGLTF.preload(POSE_URLS.type), 1500);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <Canvas camera={{ position: [0, 0.15, 3.6], fov: 32 }} dpr={[1, 2]} gl={{ alpha: true, antialias: true }}>
      <hemisphereLight args={["#ffffff", "#c9d3e6", 1.1]} />
      <directionalLight position={[2.5, 4, 3]} intensity={2} />
      <directionalLight position={[-3, 1.5, -2]} intensity={0.6} />
      <Suspense fallback={null}>
        <Mascot pose={pose} />
      </Suspense>
    </Canvas>
  );
}
