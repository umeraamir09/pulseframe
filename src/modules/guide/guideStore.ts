import { create } from "zustand";

export type ScenarioId = "motion-sickness" | "choking" | "smoke-burns";
export type MascotPose = "wave" | "point" | "type";

/**
 * idle: Pulse rests in the dock.
 * picking: the scenario picker is open (scene 1).
 * running: Pulse drives the app on practice data.
 * finishing: the wipe and the flight home.
 * done: the "Your turn" card is up.
 */
export type GuideStatus = "idle" | "picking" | "running" | "finishing" | "done";

export interface GuideState {
  status: GuideStatus;
  scenarioId: ScenarioId;
  /** 1-based scene shown as "Scene N of M". */
  scene: number;
  sceneCount: number;
  /** What Pulse is saying in the bubble. */
  line: string;
  /** Bumps on every new line so the bubble can pop. */
  lineKey: number;
  paused: boolean;
  muted: boolean;
  pose: MascotPose;
  /** Last scenario that finished, for the closing card. */
  finished?: ScenarioId;
  /** Pulse has finished this beat and waits for Next (button, Enter or the right arrow). */
  awaitingNext: boolean;
  /** Label on the Next button, e.g. "Finish" on the last beat. */
  nextLabel: string;
  /** Wall-clock time the wipe started, for the sweep effect. */
  wipeAt?: number;
  /** Wall-clock time of the finish, for the confetti. */
  confettiAt?: number;
  set: (patch: Partial<GuideState>) => void;
}

const MUTE_KEY = "pf-guide-muted";

function readMuted(): boolean {
  try {
    return globalThis.localStorage?.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveMuted(muted: boolean): void {
  try {
    globalThis.localStorage?.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // Storage blocked: the choice lasts for this visit only.
  }
}

export const useGuide = create<GuideState>()((set) => ({
  status: "idle",
  scenarioId: "motion-sickness",
  scene: 0,
  sceneCount: 0,
  line: "",
  lineKey: 0,
  paused: false,
  muted: readMuted(),
  pose: "wave",
  awaitingNext: false,
  nextLabel: "Next",
  set: (patch) => set(patch),
}));

/** True while practice data is on screen and Pulse is driving (picker, run, wipe). */
export function guideDriving(status: GuideStatus): boolean {
  return status === "picking" || status === "running" || status === "finishing";
}
