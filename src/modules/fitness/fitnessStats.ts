import type { Workout } from "../../contracts";
import { FIRST_SEED_DAY, MISSION_DAY_TODAY, missionDayLabel, missionDayOf } from "../../data/db";

export interface DayBar {
  md: number;
  label: string;
  planned: number;
  resistive: number;
  aerobic: number;
}

/** Planned versus completed minutes per mission day. Planned uses `plannedMinutes ?? 0`. */
export function weekBars(rows: Workout[]): DayBar[] {
  const days: DayBar[] = [];
  for (let md = FIRST_SEED_DAY; md <= MISSION_DAY_TODAY; md++) {
    days.push({ md, label: missionDayLabel(md), planned: 0, resistive: 0, aerobic: 0 });
  }
  for (const w of rows) {
    const day = days.find((d) => d.md === missionDayOf(w.at));
    if (!day) continue;
    day.planned += w.plannedMinutes ?? 0;
    if (w.completed) day[w.kind] += w.minutes;
  }
  return days;
}

export interface Adherence {
  plannedSessions: number;
  completedSessions: number;
  plannedMinutes: number;
  completedMinutes: number;
  extraSessions: number;
  pct: number;
}

/** Completed planned sessions over planned sessions. Unplanned extra sessions are counted separately. */
export function adherence(rows: Workout[]): Adherence {
  const planned = rows.filter((w) => w.plannedMinutes !== undefined);
  const completed = planned.filter((w) => w.completed);
  const plannedSessions = planned.length;
  return {
    plannedSessions,
    completedSessions: completed.length,
    plannedMinutes: planned.reduce((s, w) => s + (w.plannedMinutes ?? 0), 0),
    completedMinutes: rows.filter((w) => w.completed).reduce((s, w) => s + w.minutes, 0),
    extraSessions: rows.filter((w) => w.plannedMinutes === undefined && w.completed).length,
    pct: plannedSessions ? Math.round((completed.length / plannedSessions) * 100) : 0,
  };
}
