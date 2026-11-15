import { Component, Suspense, lazy, useState, type ReactNode } from "react";
import type { MascotPose } from "./guideStore";

const MascotScene = lazy(() => import("./MascotScene"));

function canUse3d(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

class StillOnError extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Pulse: the 3D model, or a still render of the same pose with reduced motion, without WebGL, or on error. */
export function Mascot({ pose }: { pose: MascotPose }) {
  const [use3d] = useState(canUse3d);
  const still = <img className="guide-mascot-still" src={`/mascot/pulse-${pose}.png`} alt="" draggable={false} />;
  if (!use3d) return still;
  return (
    <StillOnError fallback={still}>
      <Suspense fallback={still}>
        <MascotScene pose={pose} />
      </Suspense>
    </StillOnError>
  );
}
