import { Component, Suspense, lazy, useDeferredValue, useState, type ReactNode } from "react";
import type { AstronautPose } from "./AstronautScene";

const AstronautScene = lazy(() => import("./AstronautScene"));

const STILL_SRC = "/mascot.jpg";

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

/** Any error while loading or drawing the model shows the still image instead. */
class StillOnError extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * The assistant's astronaut: waves when idle, types while an answer is on its
 * way, points at a new answer. Falls back to a still image without WebGL, with
 * reduced motion, while the model loads, and on any error.
 */
export function AstronautAvatar({ pose, label }: { pose: AstronautPose; label: string }) {
  const [use3d] = useState(canUse3d);
  // Keep showing the current pose until the next model has loaded (Suspense + deferred value).
  const shown = useDeferredValue(pose);

  const still = <img className="astro-still" src={STILL_SRC} alt="" />;
  return (
    <div className={`astro-avatar pose-${pose}`} role="img" aria-label={label}>
      {use3d ? (
        <StillOnError fallback={still}>
          <Suspense fallback={still}>
            <AstronautScene pose={shown} />
          </Suspense>
        </StillOnError>
      ) : (
        still
      )}
    </div>
  );
}
