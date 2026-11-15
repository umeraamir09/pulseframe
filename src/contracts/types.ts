import type { MeasurementKey, SkeletonRegionId } from "./keys.ts";

export type CrewId = string;
export type IsoDateTime = string;

export type MeasurementSource =
  | "manual"
  | "checklist"
  | "emergency-test"
  | "device-sim"
  | "computed";

export type AlertSeverity = "watch" | "act";
export type PacketPriority = "routine" | "emergency";
export type PacketStatus = "queued" | "sending" | "sent" | "failed";
export type WorkoutKind = "resistive" | "aerobic";

export type EmergencyStage =
  | "intake"
  | "pinpoint"
  | "current-info"
  | "differential"
  | "tests"
  | "immediate"
  | "kit"
  | "handoff"
  | "monitoring";

export interface CrewProfile {
  id: CrewId;
  displayName: string;
  role: string;
  simulated: true;
}

export interface Measurement {
  id: string;
  crewId: CrewId;
  key: MeasurementKey;
  value: number;
  unit: string;
  source: MeasurementSource;
  takenAt: IsoDateTime;
  caseId?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  pack: string;
  strength: string;
  route: string;
  /** null when the source does not state it. */
  quantityOnBoard: number | null;
  location: string;
  sideEffects: string;
  comments: string;
  sourceUrl: string;
  provenance: "historical-demo-subset" | "researcher-list";
  /** Page number in the source PDF. */
  sourcePage?: string;
}

export interface EmergencyCase {
  id: string;
  crewId: CrewId;
  narrative: string;
  regionIds: SkeletonRegionId[];
  startedAt: IsoDateTime;
  status: "open" | "monitoring" | "closed";
  currentInfoSnapshot?: string;
  /** Resume the flow after reload. */
  stage: EmergencyStage;
  protocolId?: string;
  /** Emergency SyncPacket id after handoff. */
  packetId?: string;
  closedAt?: IsoDateTime;
}

export interface ProtocolStep {
  id: string;
  caseId: string;
  kind: "test" | "action";
  title: string;
  instruction: string;
  inputKey?: MeasurementKey;
  completed: boolean;
  resultValue?: number;
  order: number;
  completedAt?: IsoDateTime;
  /** Measurement written from this test. */
  measurementId?: string;
}

export interface Recommendation {
  id: string;
  caseId: string;
  itemIds: string[];
  rationale: string;
  cautions: string;
  needsSurgeonReview: boolean;
  createdAt: IsoDateTime;
  offlineFallback: boolean;
}

export interface MedicationAdmin {
  id: string;
  crewId: CrewId;
  itemId: string;
  caseId?: string;
  doseText: string;
  givenAt: IsoDateTime;
  confirmedBy: string;
}

export interface ChecklistItem {
  id: string;
  missionDay: string;
  label: string;
  kind: "meds" | "vitals" | "exercise" | "radiation" | "psych" | "other";
  required: boolean;
  doneAt?: IsoDateTime;
  value?: number;
  /** Second value for paired readings, e.g. diastolic when linkedKey is systolicBP. */
  value2?: number;
  linkedKey?: MeasurementKey;
  itemId?: string;
  /** Short guidance shown under the label. Demonstration copy, never a dose. */
  note?: string;
  /** Public source that motivates the item. */
  sourceUrl?: string;
  /** Display order within the day. */
  order?: number;
}

export interface Baseline {
  crewId: CrewId;
  key: MeasurementKey;
  windowDays: number;
  mean: number;
  std: number;
  updatedAt: IsoDateTime;
}

export interface Alert {
  id: string;
  crewId: CrewId;
  key: MeasurementKey;
  severity: AlertSeverity;
  zScore?: number;
  ruleId: "z-watch" | "z-act" | "hard-bound" | "missing-routine";
  message: string;
  mean?: number;
  std?: number;
  value: number;
  openedAt: IsoDateTime;
  ackedAt?: IsoDateTime;
  measurementId?: string;
  caseId?: string;
  windowDays?: number;
  sampleCount?: number;
}

export interface Workout {
  id: string;
  crewId: CrewId;
  at: IsoDateTime;
  kind: WorkoutKind;
  device?: string;
  minutes: number;
  completed: boolean;
  notes?: string;
  /** Demonstration plan, not a NASA prescription. */
  plannedMinutes?: number;
}

export interface RadiationReading {
  id: string;
  crewId: CrewId;
  at: IsoDateTime;
  cumulativeMgy: number;
  rateUgyPerHour?: number;
  source: "simulatedCAD" | "manual";
}

export interface PsychCheck {
  id: string;
  crewId: CrewId;
  at: IsoDateTime;
  mood: number;
  stress: number;
  teamStrain: number;
  sleepQuality: number;
  note?: string;
}

export interface SyncPacket {
  id: string;
  crewId: CrewId;
  kind: "routine-summary" | "emergency-case";
  createdAt: IsoDateTime;
  priority: PacketPriority;
  destination: "earth-surgeon" | "other-portal";
  payloadJson: string;
  checksum: string;
  status: PacketStatus;
  retryCount: number;
  nextAttemptAt?: IsoDateTime;
  sentAt?: IsoDateTime;
  receivedAt?: IsoDateTime;
}

export interface GroundReceipt {
  /** Same as SyncPacket.id, so retries dedupe. */
  id: string;
  receivedAt: IsoDateTime;
  checksumOk: boolean;
  priority: PacketPriority;
  kind: SyncPacket["kind"];
  payloadJson: string;
}

/** The surface Dev A writes to and Dev B persists. Implemented in src/data/store.ts. */
export interface PulseframeStore {
  // existing
  getCrew(): Promise<CrewProfile>;
  listMeasurements(crewId: CrewId, from?: IsoDateTime, to?: IsoDateTime): Promise<Measurement[]>;
  addMeasurement(m: Omit<Measurement, "id">): Promise<Measurement>;
  listAlerts(crewId: CrewId): Promise<Alert[]>;
  getBaselines(crewId: CrewId): Promise<Baseline[]>;
  listInventory(): Promise<InventoryItem[]>;
  saveCase(c: EmergencyCase): Promise<EmergencyCase>;
  getOpenCase(crewId: CrewId): Promise<EmergencyCase | undefined>;

  // measurements and alerts
  recordMeasurement(m: Omit<Measurement, "id">): Promise<{ measurement: Measurement; alert?: Alert }>;
  saveAlert(a: Alert): Promise<Alert>;
  ackAlert(id: string, at?: IsoDateTime): Promise<Alert | undefined>;
  clearAlerts(crewId: CrewId): Promise<void>;
  saveBaselines(b: Baseline[]): Promise<void>;

  // inventory, cases, steps, recommendations, meds
  putInventory(items: InventoryItem[]): Promise<void>;
  getCase(id: string): Promise<EmergencyCase | undefined>;
  listCases(crewId: CrewId): Promise<EmergencyCase[]>;
  listSteps(caseId: string): Promise<ProtocolStep[]>;
  saveSteps(steps: ProtocolStep[]): Promise<void>;
  saveRecommendation(r: Recommendation): Promise<Recommendation>;
  listRecommendations(caseId: string): Promise<Recommendation[]>;
  recordMedicationAdmin(a: Omit<MedicationAdmin, "id">): Promise<MedicationAdmin>;
  listMedicationAdmins(crewId: CrewId, from?: IsoDateTime): Promise<MedicationAdmin[]>;

  // daily modules
  listChecklist(missionDay: string): Promise<ChecklistItem[]>;
  saveChecklistItem(i: ChecklistItem): Promise<ChecklistItem>;
  listWorkouts(crewId: CrewId, from?: IsoDateTime): Promise<Workout[]>;
  saveWorkout(w: Workout): Promise<Workout>;
  listRadiation(crewId: CrewId, from?: IsoDateTime): Promise<RadiationReading[]>;
  addRadiation(r: Omit<RadiationReading, "id">): Promise<RadiationReading>;
  listPsych(crewId: CrewId, from?: IsoDateTime): Promise<PsychCheck[]>;
  addPsych(p: Omit<PsychCheck, "id">): Promise<PsychCheck>;

  // sync
  listPackets(): Promise<SyncPacket[]>;
  savePacket(p: SyncPacket): Promise<SyncPacket>;
  listGroundReceipts(): Promise<GroundReceipt[]>;
  saveGroundReceipt(r: GroundReceipt): Promise<void>;

  // lifecycle
  getMeta(key: string): Promise<unknown>;
  setMeta(key: string, value: unknown): Promise<void>;
  resetAll(): Promise<void>;
  subscribe(listener: () => void): () => void;
}
