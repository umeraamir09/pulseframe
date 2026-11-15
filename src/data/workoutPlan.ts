import type { WorkoutKind } from "../contracts";

/**
 * Daily exercise plan for the simulated crew member.
 * Demonstration plan values, not a NASA prescription.
 */
export interface PlannedSession {
  kind: WorkoutKind;
  /** Local hour the session is scheduled. */
  hour: number;
  plannedMinutes: number;
}

export const DEMO_WORKOUT_PLAN: PlannedSession[] = [
  { kind: "resistive", hour: 8, plannedMinutes: 60 },
  { kind: "aerobic", hour: 16, plannedMinutes: 30 },
];

/** Exercise devices named on the cited NASA pages. */
export const EXERCISE_DEVICES: Record<WorkoutKind, string[]> = {
  resistive: ["ARED"],
  aerobic: ["T2 treadmill", "CEVIS cycle"],
};

export const EXERCISE_SOURCES = [
  { title: "NASA: Astronaut exercise", url: "https://www.nasa.gov/missions/station/iss-research/astronaut-exercise/" },
  { title: "NASA JSC: Exercise countermeasures", url: "https://www.nasa.gov/reference/jsc-exercise-countermeasures/" },
] as const;
