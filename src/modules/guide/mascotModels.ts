import { useGLTF } from "@react-three/drei";
import type { MascotPose } from "./guideStore";

/** One GLB per pose, each with a looping 2 s clip of the same name. */
export const POSE_URLS: Record<MascotPose, string> = {
  wave: "/models/mascot-wave.glb",
  point: "/models/mascot-point.glb",
  type: "/models/mascot-type.glb",
};

export function preloadMascot(): void {
  for (const url of Object.values(POSE_URLS)) useGLTF.preload(url);
}
