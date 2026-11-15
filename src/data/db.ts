/** Public data barrel. UI modules import data only from here. Files inside src/data import from ./store. */
export { store, SIM_CREW, connect, id } from "./store";
export * from "./live";
export * from "./mission";
export { queuePacket, queueEmergencyCase } from "./sync";
export { initData } from "./init";
export { resetDemoData } from "./seed";
export { DEMO_WORKOUT_PLAN, EXERCISE_DEVICES, EXERCISE_SOURCES, type PlannedSession } from "./workoutPlan";
export {
  explainAlert,
  rollingBaselineSeries,
  BASELINE_WINDOW_DAYS,
  Z_WATCH,
  Z_ACT,
  type BaselinePoint,
} from "./anomaly";
export { rebuildAlerts } from "./alerts";
export { DEMO_HARD_BOUNDS } from "./demoBounds";
