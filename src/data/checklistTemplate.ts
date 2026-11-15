import type { ChecklistItem, MeasurementKey } from "../contracts";

/**
 * Daily checklist template for the simulated mission.
 *
 * Items are shaped by public sources on ISS crew routines (linked per item). Times and
 * minutes are demonstration values, not a NASA prescription. Medication items never carry
 * a dose: the flight surgeon directs dosing, Pulseframe only records that it was taken.
 */
export interface ChecklistTemplateItem {
  slug: string;
  kind: ChecklistItem["kind"];
  label: string;
  required: boolean;
  linkedKey?: MeasurementKey;
  /** Hour of day (local, decimal) the item is normally done, used by the seed. */
  hour: number;
  note?: string;
  sourceUrl?: string;
}

const SRC = {
  vitaminD: "https://ntrs.nasa.gov/citations/20130013531",
  medUse:
    "https://www.news-medical.net/news/20151104/New-study-examines-medications-used-by-astronauts-on-long-duration-spaceflight-missions.aspx",
  healthCare: "https://www.nasa.gov/missions/station/faq-the-real-story-about-astronaut-health-care-in-space",
  exercise: "https://www.nasa.gov/missions/station/iss-research/astronaut-exercise/",
  hazards: "https://www.nasa.gov/hrp/hazards/",
} as const;

export const CHECKLIST_TEMPLATE: ChecklistTemplateItem[] = [
  // meds
  {
    slug: "vitamin-d",
    kind: "meds",
    label: "Vitamin D supplement",
    required: true,
    hour: 7.5,
    note: "Required for crew: station shielding blocks UV light and the food system has few vitamin D sources. Take as directed by the flight surgeon.",
    sourceUrl: SRC.vitaminD,
  },
  {
    slug: "scheduled-med",
    kind: "meds",
    label: "Prescribed medication, as directed by the flight surgeon",
    required: true,
    hour: 7.5,
    note: "Confirm you took your scheduled medication. Pulseframe records that it was taken and never suggests a dose.",
    sourceUrl: SRC.healthCare,
  },
  {
    slug: "prn-med",
    kind: "meds",
    label: "Log any as-needed medication taken",
    required: false,
    hour: 21,
    note: "Sleep, pain, congestion and allergy medicines were the most used on ISS. Logging what you took keeps the flight surgeon's picture complete.",
    sourceUrl: SRC.medUse,
  },
  // vitals
  { slug: "heart-rate", kind: "vitals", label: "Morning heart rate", required: true, linkedKey: "heartRate", hour: 7, sourceUrl: SRC.healthCare },
  { slug: "blood-pressure", kind: "vitals", label: "Blood pressure", required: true, linkedKey: "systolicBP", hour: 7, sourceUrl: SRC.healthCare },
  { slug: "temperature", kind: "vitals", label: "Body temperature", required: true, linkedKey: "temperatureC", hour: 7 },
  { slug: "oxygen-sat", kind: "vitals", label: "Oxygen saturation", required: true, linkedKey: "oxygenSat", hour: 7 },
  {
    slug: "blood-glucose",
    kind: "vitals",
    label: "Blood glucose",
    required: false,
    linkedKey: "bloodGlucose",
    hour: 7,
    note: "Optional fingerstick reading.",
  },
  {
    slug: "pain",
    kind: "vitals",
    label: "Pain check",
    required: false,
    linkedKey: "painScore",
    hour: 20,
    note: "0 is no pain, 10 is the worst imaginable. Back pain is common in microgravity.",
  },
  // exercise
  {
    slug: "resistive",
    kind: "exercise",
    label: "Resistive session (ARED)",
    required: true,
    hour: 9,
    note: "About an hour on the resistive device, part of the scheduled 2.5 hours of daily exercise for muscle and bone.",
    sourceUrl: SRC.exercise,
  },
  {
    slug: "aerobic",
    kind: "exercise",
    label: "Aerobic session (T2 treadmill or CEVIS cycle)",
    required: true,
    hour: 16.5,
    note: "Cardio on the treadmill or cycle ergometer, for aerobic and sensorimotor health.",
    sourceUrl: SRC.exercise,
  },
  // radiation
  {
    slug: "dosimeter",
    kind: "radiation",
    label: "Read personal dosimeter",
    required: true,
    hour: 12,
    note: "Log today's dose rate from the crew dosimeter.",
    sourceUrl: SRC.hazards,
  },
  // psych
  {
    slug: "psych",
    kind: "psych",
    label: "Evening psychology check-in",
    required: true,
    hour: 20,
    note: "Mood, stress, team strain and sleep quality. A simple self-report, not WinSCAT.",
    sourceUrl: SRC.hazards,
  },
  // other
  { slug: "sleep", kind: "other", label: "Log sleep", required: true, linkedKey: "sleepHours", hour: 6.5 },
  {
    slug: "hydration",
    kind: "other",
    label: "Water intake",
    required: false,
    hour: 21,
    note: "Low fluid intake raises the risk of headaches, weaker exercise performance and kidney stones.",
  },
];

export function checklistItemId(md: number, slug: string): string {
  return `chk-${md}-${slug}`;
}
