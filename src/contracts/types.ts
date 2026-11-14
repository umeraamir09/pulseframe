import type { MeasurementKey, SkeletonRegionId } from "./keys";

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
  quantityOnBoard: number;
  location: string;
  sideEffects: string;
  comments: string;
  sourceUrl: string;
}

export interface EmergencyCase {
  id: string;
  crewId: CrewId;
  narrative: string;
  regionIds: SkeletonRegionId[];
  startedAt: IsoDateTime;
  status: "open" | "monitoring" | "closed";
  currentInfoSnapshot?: string;
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
  linkedKey?: MeasurementKey;
  itemId?: string;
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

/** The surface Dev A writes to and Dev B persists. Implement in src/data. */
export interface PulseframeStore {
  getCrew(): Promise<CrewProfile>;
  listMeasurements(crewId: CrewId, from?: IsoDateTime, to?: IsoDateTime): Promise<Measurement[]>;
  addMeasurement(m: Omit<Measurement, "id">): Promise<Measurement>;
  listAlerts(crewId: CrewId): Promise<Alert[]>;
  getBaselines(crewId: CrewId): Promise<Baseline[]>;
  listInventory(): Promise<InventoryItem[]>;
  saveCase(c: EmergencyCase): Promise<EmergencyCase>;
  getOpenCase(crewId: CrewId): Promise<EmergencyCase | undefined>;
}
