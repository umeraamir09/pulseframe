# Batch 1 gaps and low-confidence items

Date accessed for all sources: 2026-11-15. Scope: section 2 (inventory top 30) and section 3 (equipment, plus new-measurement-keys.csv). Section 5 is handled by another researcher.

## How quotes were checked
- Every quote was checked by script against the text of the fetched source (pdftotext for PDFs, PubMed abstract text for papers, saved HTML for PMC pages). Whitespace is normalised. Scripts: `/workspace/pulseframe-research/work/` (inv.py, equip.py, keys.py, srcs.py).
- Table rows (inventory, kit lists): a PDF table has no running sentence, so the quote joins the row's cells with " | " (for example `Aspirin | 325 mg | Oral | 60 | tablet | B4`). Each cell was checked against the PDF page.
- Two PCBA quotes keep the source's curly quotes (‘LCK’, ‘INSUFFICIENT SAMPLE’).

## Big caveats (read first)
1. **No current public ISS kit list with quantities and locations.** The newest NASA-published kit list with quantity, location and side effects is the 2015 MED CL/SpX-6 checklist (09 APR 15). Every inventory row is therefore `environment: iss-historical`. Each row has a `formulary2023` status and a `formulary2023Detail` block that cross-check the 2023 ISS formulary (Diaz et al. 2024, npj Microgravity, from a 2023 FOIA release, grade A). That paper prints shelf life only, not quantity or location.
2. **Equipment procedures are 2001 and 2015 era.** The step-by-step sources are the 2001 ISS IMG Medical Checklist (JSC-48522-E4) and the partial 2016 FOIA release of the emergency procedures (pages dated 20 APR 15). Hardware descriptions come from the 2011 CHeCS Hardware Catalog. Current (2020s) ISS device models and procedures: NOT FOUND in public sources.
3. **Hosting.** The 2001 checklist is a NASA document, but the original nasa.gov URL (`https://www.nasa.gov/pdf/163533main_iss_med_cl.pdf`) returns 404. We used a mirror at newspaceeconomy.ca. The 2016 manual is hosted by governmentattic.org (FOIA release). Both are graded A as NASA documents. A reviewer may prefer B because they are third-party hosted.

## Inventory (inventory.json, 30 rows)
Each row has a `formulary2023` field set to `confirmed`, `not-listed` or `unknown`. The checks behind it are in `formulary2023Detail` (Diaz et al. 2024, Tables 1 to 5).
- confirmed: 27
- not-listed: 3 (kit-red-atropine, kit-red-lidocaine-io, kit-white-hypromellose). All three stay in the file with the `iss-historical` tag.
- unknown: 0

Items that are confirmed but whose details changed: zolpidem (10 mg in 2015, 5 mg in 2023) and EpiPen (strength now written as 0.3 mg/0.3 mL). Ondansetron is confirmed, but the paper spells it "Ondansteron".

| Item | Gap |
| --- | --- |
| kit-red-atropine | NOT FOUND in the 2023 formulary tables (Diaz 2024 Tables 1 to 5). May have been removed. 2015 data only. |
| kit-red-lidocaine-io | Same: the IO lidocaine syringe is NOT FOUND in the 2023 tables. 2023 lists other lidocaine products (1% vial, 2% with epinephrine, jelly) in the topical and injectable pack. |
| kit-white-hypromellose | Marked `not-listed`: the 2015 product Nature's Tears is not in the 2023 list. 2023 has "Dextran, Glycerin and Hypromellose (GenTeal Tears)", a different product. |
| kit-white-zolpidem | 2015 strength 10 mg. 2023 formulary lists 5 mg. The app should show both, or prefer 2023 after review. |
| kit-red-epinephrine-autoinjector | 2015 strength "1:1000, 0.3 mL". 2023 says "0.3 mg/0.3 mL autoinjector". |
| kit-purple-nitroglycerin | The source gives the route as "Oral". Kept verbatim. Nitrostat is normally used under the tongue (general knowledge, not sourced). Needs a reviewer. |
| All 30 | `contraindications` is empty for every row. The 2015 checklist has no contraindication column. Our sources did not cover drug-label contraindications (DailyMed was not checked in Batch 1). |
| All 30 | `indications` is the checklist's category heading (for example "Sleep", "Decongestant") put into plain words. The source has no labeled-indication column. |
| All 30 | `labeledDoseText` is filled only where the checklist states a limit (acetaminophen, ibuprofen, loperamide, oxymetazoline). There are no other dose texts in the source. |
| ALS drugs (red pack) | Physician-directed advanced life support items. Included because other researchers need their ids. Not for layperson use without guidance. |
| Pack names | 2023 pack names differ (5 packs, including a new "vascular contingency" pack). Our `pack` field uses 2015 names. |
| Self-administration rules | Not researched in Batch 1. |

## Equipment (equipment.json, 14 entries)
Two entries were added on request from the Conditions & Protocols researcher. Both are devices, so they are in equipment.json. Their ids were also appended to inventory-ids.txt, labelled "(device, in equipment.json)".
- **eq-eye-chart**: Eye Chart (Visual Acuity Card, near vision).
  - On board: 2015 kit checklist, Medical Diagnostic Pack (Blue), "Eye Chart 1 with Locator Card"; 2011 CHeCS catalog, Physical Exam Pack, "Visual Acuity Card". Grade A.
  - Steps: 2001 ISS Medical Checklist, Eye Examination, step 2 Ocular Acuity Examination (PDF p.569). Grade A.
  - Gaps: the 2015 chart type (near or distance) and its scoring format are NOT FOUND. The 2001 procedure is for a near-vision card at about 40 cm. No sourced microgravity change; "hold or fix the card because it floats" is a team inference.
- **eq-eyewash**: Space Station Eyewash (SSE) with eyewash goggles.
  - On board: 2011 CHeCS catalog, section 4.3 Crew Contamination Protection Kit, Eyewash Kit with "Eye Goggles and Tubing". Grade A.
  - Steps: 2001 ISS Medical Checklist, Eye Problems - Chemical Burn (PDF p.577 to 579); 2016 FOIA manual, 1.106 Toxic Exposure, step 2.2. Grade A.
  - Gaps: the 2015 procedure 2.3.304 "Eyewash Kit Use" is referenced but NOT FOUND in public sources. The 2015 manual names port CBO-3B, the 2001 and 2011 sources name SVO-ZV; current port is unknown. Whether the eyewash is still on board after 2015: NOT FOUND. The optional proparacaine eye drop step from 2001 was left out of the plain steps (drug, surgeon-directed). Proparacaine is not in inventory.json.
  - Related item not added: separate Safety Goggles (qty 7, CCPK, "Eye protection to be worn during particulate cleanup procedures") are listed in the 2011 catalog. These are protective goggles, not eyewash goggles. They can be added on request.
- Where we looked for both: 2015 kit checklist (Tables 1 to 11), 2016 FOIA emergency manual, 2001 ISS IMG Medical Checklist (eye exam, chemical burn, CCPK and index pages), 2011 CHeCS Hardware Catalog (sections 4.2 and 4.3), and Diaz 2024 (drugs only, so not relevant for devices).

| Entry | Gap |
| --- | --- |
| eq-bp-monitor | Brand and model of the 2015 "Blood Pressure Monitor": NOT FOUND. The detailed procedure 2.0.304 is referenced but not in the public release. Duration: NOT FOUND. |
| eq-abpc | Detailed 2001 procedure is available, but the device may be retired. Current status: NOT FOUND. |
| eq-bp-ecg | No public crew procedure. Steps left empty, marked NOT FOUND. |
| eq-blood-oximeter | Procedure 2.0.305 is referenced but not public. Microgravity effect on pulse oximetry: NOT FOUND. Duration: NOT FOUND. |
| eq-thermometer-oral | ISS-specific how-to-use: NOT FOUND. Steps come from the maker's directions for use (grade C). The 2015 kit says only "Thermometer" with no type. Tempa-DOT is confirmed only for 2001 and 2011. |
| eq-pcba-istat | 2001 procedure. Current use on ISS is uncertain. A review (grade B) says it is rarely used because cartridges last 6 months. No dedicated glucometer was found on ISS lists. Glucose range 70 to 105 mg/dL is the checklist's printed reference range, not an in-flight range. |
| eq-urine-chemstrip | "Recommended time" before reading the strip: NOT FOUND. |
| eq-hrm2, eq-aed, eq-cmrs | Steps NOT FOUND (HRM2, CMRS) or out of scope (AED resuscitation). |
| selfUsePossible / needsSecondPerson | Not stated by any source. Left null where we had no basis. Where filled, `selfUseBasis` says it is a team inference. |
| Microgravity method changes | Found and sourced: restrain the patient for vital signs; tape small items down during the blood test; collect urine on swabs held in the stream; in-flight blood test differences come from sample collection. No sourced microgravity change was found for the BP cuff method, pulse oximetry or oral temperature. |
| Not covered in Batch 1 | Ultrasound and remote guidance, tonometer and ophthalmoscope steps, otoscope, dental, air/CO2/water monitors, radiation dosimeters, body mass device steps, Artemis/Orion and Mars-design equipment. |

## new-measurement-keys.csv (15 rows)
- An in-flight normal range was found for 1 key only (carbonMonoxideSat, Makowski 2019).
- For 6 keys (Na, K, iCa, pH, Hct, Hb) the range is the 2001 checklist's printed reference range. It is labelled as not an in-flight range.
- 8 rows say NOT FOUND for the in-flight range: respiratoryRate, urine glucose, urine ketones, urine SpG, bodyMass, intraocularPressure, visualAcuity, ecgRhythm.
- The visualAcuity row now links to eq-eye-chart.
- Not added because no source was found in Batch 1: grip strength, pupil response, balance test, cognitive test score, hydration by urine colour, urine output, CO2 symptoms.
- Recommendation for keys.ts: `bloodGlucose` in mg/dL matches the PCBA output unit (checklist column "Glu (mg/dL)").

## Where we looked
- NASA: 2015 kit checklist (nasa.gov), 2001 IMG Medical Checklist (mirror), 2016 FOIA emergency manual (governmentattic.org), CHeCS Hardware Catalog v10.0 2011 (NTRS 20110022379). We also saw NTRS 20070032039 (Autonomous Medical Care), NTRS 20210020201 (Exploration CMO) and the HMS hardware report in search results, but did not use them.
- Peer-reviewed: Diaz 2024 npj Microgravity (PMC11266549), Smith 1997 Clin Chem (PMID 9191561), Stahn 2017 Sci Rep (PMID 29170507), Norsk 2015 J Physiol (PMID 25774397), Makowski 2019 AMHP (PMID 30670117).
- Secondary: Cummins et al., Biotechnology Advances review (PMC4833668).
- General: Tempa-DOT directions for use (medicalindicators.com).
- Searched without a usable result: a public post-2020 ISS medical checklist with quantities; a public ISS procedure for pulse oximetry or BP in microgravity; an ISS glucometer.
- Seen but not used: WikEM and spacemedicinefoundation.org. Both repeat the 2023 formulary. We used the primary paper instead.

## Open questions for the team
1. Should the app use 2015 quantities with a "historical" badge, or show only items confirmed in the 2023 formulary?
2. For atropine and IO lidocaine (not in 2023): keep them, hide them, or flag them?
3. Is a C-grade maker instruction acceptable for the thermometer steps?
