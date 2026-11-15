/** Mission day helpers. MD 142 is today on the device clock; the seed covers MD 136 to MD 142. */
export const MISSION_DAY_TODAY = 142;
export const SEED_DAYS = 7;
export const FIRST_SEED_DAY = MISSION_DAY_TODAY - SEED_DAYS + 1;

const DAY_MS = 24 * 60 * 60 * 1000;

function todayMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Local midnight of a mission day. */
export function missionDayStart(md: number): Date {
  const d = todayMidnight();
  d.setDate(d.getDate() - (MISSION_DAY_TODAY - md));
  return d;
}

export function missionDayOf(iso: string): number {
  const t = new Date(iso);
  t.setHours(0, 0, 0, 0);
  return MISSION_DAY_TODAY - Math.round((todayMidnight().getTime() - t.getTime()) / DAY_MS);
}

export function missionDayLabel(md: number): string {
  return `MD ${md}`;
}
