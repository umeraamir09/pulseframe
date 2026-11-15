import type { InventoryItem } from "../../contracts";

/**
 * Transcribed only from the public NASA ISS medical kit checklist
 * (MED CL/SpX-6, 09 Apr 2015), Table 1, Convenience Medication Pack (White).
 * https://www.nasa.gov/wp-content/uploads/2015/03/medical_kit_checklist_-_full_release.pdf
 *
 * Historical demonstration subset, not a current flight kit.
 * Every field is copied from that PDF. Strength is the labeled product
 * strength in the checklist, not a dose to give. Pulseframe never suggests a dose.
 * The id pack token `white` is the pack color in the table title.
 */

export const NASA_ISS_KIT_PDF_URL =
  "https://www.nasa.gov/wp-content/uploads/2015/03/medical_kit_checklist_-_full_release.pdf";

const PACK = "Convenience Medication Pack (White)";

export const DEMO_ISS_KIT_SUBSET: InventoryItem[] = [
  {
    id: "kit-white-olopatadine",
    name: "Olopatadine (Pataday)",
    pack: PACK,
    strength: "0.2 %, 2.5 mL",
    route: "Eye",
    quantityOnBoard: 6,
    location: "A3",
    sideEffects: "Blurred vision, eye pain, stinging, burning, headache",
    comments:
      "Remove contact lenses before use. After instilling drops, wait at least 10 minutes before inserting contact lenses.",
    sourceUrl: NASA_ISS_KIT_PDF_URL,
    provenance: "historical-demo-subset",
    sourcePage: "2",
  },
  {
    id: "kit-white-oxymetazoline",
    name: "Oxymetazoline (Afrin)",
    pack: PACK,
    strength: "0.05 %, 15 mL",
    route: "Intranasal",
    quantityOnBoard: 10,
    location: "A1",
    sideEffects: "Transient burning, stinging, dryness of the nasal mucosa, sneezing, cough",
    comments: "Do not use more than 3 consecutive days. Rebound congestion with prolonged use.",
    sourceUrl: NASA_ISS_KIT_PDF_URL,
    provenance: "historical-demo-subset",
    sourcePage: "3",
  },
  {
    id: "kit-white-hypromellose",
    name: "Hypromellose (Nature\u2019s Tears)",
    pack: PACK,
    strength: "0.4 %, 15 mL",
    route: "Eye",
    quantityOnBoard: 2,
    location: "A4",
    sideEffects: "Temporary blurred vision",
    comments: "Remove contact lenses prior to use.",
    sourceUrl: NASA_ISS_KIT_PDF_URL,
    provenance: "historical-demo-subset",
    sourcePage: "3",
  },
  {
    id: "kit-white-aspirin",
    name: "Aspirin",
    pack: PACK,
    strength: "325 mg",
    route: "Oral",
    quantityOnBoard: 60,
    location: "B4",
    sideEffects: "Upset stomach, dizziness, ringing in ears, blood in stool",
    comments: "Take with food.",
    sourceUrl: NASA_ISS_KIT_PDF_URL,
    provenance: "historical-demo-subset",
    sourcePage: "3",
  },
  {
    id: "kit-white-melatonin",
    name: "Melatonin",
    pack: PACK,
    strength: "3 mg",
    route: "Oral",
    quantityOnBoard: 60,
    location: "A4",
    sideEffects: "Headache, nausea, drowsiness, dizziness",
    comments: "Do not use with other sleep meds.",
    sourceUrl: NASA_ISS_KIT_PDF_URL,
    provenance: "historical-demo-subset",
    sourcePage: "4",
  },
];
