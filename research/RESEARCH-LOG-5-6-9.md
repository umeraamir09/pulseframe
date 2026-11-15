# Research log: sections 5, 6 and 9 (Batches 1 to 3), 2026-11-15

Owner: medical events and protocols researcher. Merge into the shared RESEARCH-LOG.md if one exists.

## Files
- `conditions.csv`: 23 rows. Rows with `rank` 1 to 15 are the top 15. Rows with an empty rank were considered and left out, with a reason.
- `protocols/eye-foreign-body-abrasion.json`, `protocols/space-motion-sickness.json`, `protocols/headache-co2.json`: cards for ranks 1 to 3 (Batch 1, updated in Batch 2).
- `protocols/choking-airway.json`, `protocols/fire-smoke-burns.json`, `protocols/bleeding-laceration-abrasion.json`: cards for ranks 4 to 6 (Batch 2).
- `decisions.md`: section 9 items 1 to 6. Items 1 and 3 from Batch 1, items 2, 4, 5 and 6 from Batch 2.
- `condition-vitals.csv`, `condition-vitals.provenance.csv`, `condition-vitals-notes.md`: vital signs per condition for all 15 ranked conditions (Batch 3). Gaps are in the notes file.
- `new-measurement-keys.csv`: one row appended for `burnAreaPalms` (Batch 3). Other rows unchanged.

## Method
- Likelihood comes from the NASA IMM "Ranking of Medical Conditions by Probability" report (iMED v5.0, data as of 23 Oct 2014, report dated 2 Feb 2015), Table 2: one crew member, 6 month LEO, 1 EVA. Values are the probability of at least one event per crew member for that mission. They are not per person-year.
- Severity is a team scale: 1 = usually self-limited, 2 = can stop work or get worse without care, 3 = can threaten life, sight, or force evacuation. Each row gives the source behind the grade.
- Rank = likelihood x severity, plus the brief's "always these" list. The rank is a research recommendation, not a number from a source.
- Every quote was checked by a script against the downloaded source text before writing, and checked to be under 25 words.
- Cards validated with `ProtocolCardSchema` (zod) from a temp copy outside the repo: all 6 PASS in default mode. Strict mode fails only on the extra fields the brief asks for, which zod strips by default. The 2 existing repo cards still pass in both modes.

## Batch 2 changes
- Found a public copy of the 2001 ISS medical checklist (JSC-48522-E4). The nasa.gov link returns 404; we used the web archive copy (the Kit researcher used a mirror of the same file). It is historical, not the current checklist. Page numbers are PDF pages.
- That checklist puts this note on 31 procedures: begin treatment during loss of signal, then call the surgeon as soon as possible. All 6 cards now cite it in `whenGroundUnavailable` where the page has the note (status PARTIAL, historical rule). The choking page has no such note, so that card stays NOT FOUND for an explicit rule.
- Eye card: now lists `equipmentIds: ["eq-eye-chart", "eq-eyewash"]` from equipment.json, cites the 2001 eye exam and chemical burn pages, and drops the old "not in inventory/equipment" gap. `candidateItemIds` stays inventory only.
- New extra fields on all cards: `equipmentIds` (equipment.json ids used by tests and steps; no earlier convention existed, so we created this name) and `gaps`.
- Decision 1 updated: the 2001 checklist prints dose text inside each procedure and starred medicines need the surgeon first. No doses are copied into our files.

## Searched
NASA IMM overview page and linked reports; NASA-STD-3001 Vol 1 Appendix E; OCHMO technical brief index and briefs TB-004, TB-006, TB-007, TB-008, TB-020, TB-033, TB-037, TB-044, MTB-003, MTB-004, MTB-006, MTB-007; NASA HRP 2017 in-flight medical conditions evidence report (NTRS 20170004604); NASA/TM-2019-220299; 2015 ISS medical kit checklist; 2001 ISS medical checklist JSC-48522-E4; NASA Human Research Roadmap condition pages (choking, smoke inhalation, skin laceration); Campbell et al. 1993 (NTRS 20040198685); Crucian 2016; van Oosterhout 2024; Suh et al. and Meer et al. 2023; Hinkelbein 2020 CPR guideline; MedlinePlus (choking, bleeding, burns, carbon monoxide, disclaimers); RCP NEWS2; NIDDK; US FDA Clinical Decision Support Software guidance (January 2026).

## Not found (consolidated)
Cards and conditions:
- A current (post-2001) public ISS medical checklist. All procedure content from NASA is 2001 or the 2015 kit list.
- Microgravity technique for choking first aid: no source tests back blows or abdominal thrusts in weightlessness. Bracing advice in the choking card is team inference. No source on a crew member choking alone.
- The 2001 ISS choking page uses a blind finger sweep; current MedlinePlus advice says do not grasp a lodged object. The card follows MedlinePlus. Needs flight surgeon review.
- Minutes without air before brain injury, from a quotable source.
- Burn cooling time in flight, and how to keep cooling water from floating free beyond a wet cloth.
- A carbon monoxide (SpCO) meter in equipment.json. The 2001 checklist warns the pulse oximeter reads falsely high after carbon monoxide (this was a Batch 1 gap, now found).
- Tourniquet for bleeding in public ISS kit lists (only an IV tourniquet in 2015). Tourniquet use in flight not read (Wilderness Environ Med 2023 review found, not read in full).
- A time to hold pressure on a bleeding wound. Raising a bleeding limb is gravity-based Earth advice; left out.
- Inventory gaps: gauze, bandages, tape, burn dressings, AMBU bag, airways and forceps appear in NASA kit lists but not in inventory.json.
- Eye chart: no source we found says whether it is a near or distance chart (equipment.json calls it a near vision card at about 40 cm; check with the Kit researcher).
- Eyewash goggles: no public source shows they are still on board after 2015.
- A rate for venous thrombosis in flight (IMM table has no VTE row).
- Emesis bag or vomit containment procedure in microgravity.
- IMM burn and smoke rates are model-derived from ISS fire estimates, not flight cases.

Thresholds (decision 3):
- Spaceflight-specific "act now" values for HR, BP, SpO2, temperature, glucose, pain, and a radiation dose-rate alarm value. Diastolic BP, glucose high side and pain have no source value.

Decisions 2, 4, 5, 6:
- A current public NASA, Artemis or ESA rule for crew action without the ground (only the 2001 ISS rule).
- Disclaimer wording inside the current ISS checklist, any NASA or ESA wording for crew-facing medical software, and quotable telemedicine app disclaimers.
- How FDA device rules apply on orbit (FDA guidance used only as a design model).
- Any rule for a crew member alone in a module during an emergency, or how many crew must stay with a patient.
- The exact list of medical data downlinked from ISS, its encryption or channel rules, and ESA or JAXA crew medical privacy rules.

## Open questions for the team
1. MTB-006 says no in-flight shoulder injuries have been reported, but the IMM table marks shoulder sprain as having occurred in flight. Which to trust?
2. The IMM data is from 2014 and ISS Expeditions 1 to 13. Is a newer public IMM output available?
3. Proposed measurement keys not in `keys.ts`: `smsGrade`, `vomitCount`, `cabinCO2`, `neuroDangerSigns`, `newConfusion`, `burnAreaPalms` (now appended to new-measurement-keys.csv), plus `visualAcuity`, `respiratoryRate` and `carbonMonoxideSat` reused from new-measurement-keys.csv. Tests that need them have no `inputKey` for now.
4. Answered by the developers: `equipmentIds` stays an optional extra field on the cards, as it is now.
5. The headache card's "move to good airflow" step and the choking card's bracing step are team inference, not NASA instructions.
6. Every card is pending a second-person safety review.
