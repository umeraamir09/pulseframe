# Pulseframe product-safety decisions (section 9, items 1 to 6)

Researcher: Batch 1 (items 1 and 3) and Batch 2 (items 2, 4, 5 and 6), written 2026-11-15. All sources accessed 2026-11-15. Every row below is safety-critical (`safety: true`) and needs a second-person check before it changes app behavior.

Sections appear in the order they were written: 1, 3, then 2, 4, 5 and 6.

Confidence: A = NASA or peer reviewed, B = reputable secondary, C = general medicine not specific to spaceflight, ? = not found.

## 1. Doses

**Question.** The app refuses to show doses. In a real autonomous emergency the crew may need the labeled dose. What do onboard procedures and labels tell the crew, who authorizes, and what is the safest design?

### What the sources say

1. The public ISS kit document is a contents list, not a dosing guide [d1a]. Its columns are item, strength, route, quantity, unit, possible side effects, comments and location [d1b]. A few comment cells give a maximum count per 24 hours for over-the-counter items. Most items have no dosing text. This copy is from 2015 and is historical.
2. The real procedure document is the ISS medical checklist, JSC 48522 [d1n]. A public 2001 copy (JSC-48522-E4) was found in Batch 2 through a web archive; the current version is NOT FOUND. In the 2001 copy, dose text is printed inside the procedure next to each medicine, and starred medicines need a call to the surgeon first [d2b]. So in 2001 the crew read the dose from the approved checklist, and the ground authorized the starred ones.
3. Treatment decisions are made by the crew together with the flight surgeon [d1c]. Crew can take some mainly over-the-counter medicines without talking to the flight surgeon [d1d]. Medicine use is frequent: a 2017 study found hundreds of uses per crew member per mission [d1e].
4. The ISS crew medical officer may have no medical background [d1f]. Training is about 40 hours [d1g]. The officer is trained on when to call the ground [d1h].
5. Beyond low Earth orbit, delay or blackout can stop the ground from helping in time [d1i]. Delay can reach 40 minutes [d1m]. NASA describes decision support that gives medication and dosing information as a future need [d1j], and says it is not yet robust enough [d1k]. For planetary missions over 210 days, NASA requires a medical officer trained to physician level [d1l].
6. Medicines are chosen per crew member and per mission by the flight surgeon [d1o]. So a generic dose table built by our team would not match a real flight kit.

NOT FOUND: who signs off a dose when the ground is unreachable on ISS today (the 2001 rule is in section 2); the wording of dosing instructions inside JSC 48522; any public Artemis or Gateway dosing procedure.

### Options

| Option | What the app shows | For | Against |
| --- | --- | --- | --- |
| A. Never show doses (today) | Item, strength, side effects, comments. No dose. | No risk of the app inventing or mis-scaling a dose. Matches the 2015 public list, which is mostly not a dosing guide. | In a blackout the crew must find the dose in paper or PDF procedures under stress. |
| B. Show label dose only after ground confirms | Dose text hidden until a flight surgeon unlocks it. | Keeps the human authority that the sources describe. | Fails exactly when it is needed: during delay or blackout. |
| C. Show the mission's own approved dose text, verbatim, never computed | Read-only text copied from the flight's approved medical checklist, with page number. Shown with a banner "From onboard checklist page X". Every view is logged and sent to the ground. | Same words the crew is trained on. App adds speed, not judgment. Works in blackout. | Only as safe as the loaded data. Needs a signed data file per mission. We do not have that file. |
| D. App calculates or suggests a dose | Weight-based or symptom-based dose. | None that the sources support. | NASA itself says this kind of system is not robust yet. A non-doctor cannot check it. Highest harm. |

### Recommendation

Use **A now, built so it can become C later.** Do not ship B alone, and never ship D.

- For the hackathon: keep refusing to show doses. Show strength, route, side effects and the verbatim kit comment, plus the text "Dose: see onboard medical checklist JSC 48522 or the flight surgeon."
- Keep `labeledDoseText` empty unless it is filled from a mission-approved source with a page reference. Render it only if a `doseSource` field (document, page, approver) is present. The app must never compute, convert or round a dose.
- When the link is down, the app should point to the checklist page, start a log entry with the time and the item, and queue the case for the ground.
- Recommend that the team adds this to the Sources page: we found no public source that supports a non-doctor app giving doses.

| ref | source | section | verbatim quote | confidence |
| --- | --- | --- | --- | --- |
| d2b | [ISS Integrated Medical Group (IMG) Medical Checklist, JSC-48522-E4, 2001 (NASA JSC; original nasa.gov URL returns 404, archived copy; also mirrored at newspaceeconomy.ca). Historical, not the current checklist.](https://web.archive.org/web/20230519222418/https://www.nasa.gov/centers/johnson/pdf/163533main_ISS_Med_CL.pdf) | Same header NOTE, e.g. BURNS, PDF p.325 | "Contact Surgeon before giving any medication marked with an asterisk." | A |
| d1a | [ISS Medical Checklist 3.001 Medical Kit - Contents and Reference (MED CL/SpX-6 - ALL/FIN/T), 09 APR 15](https://www.nasa.gov/wp-content/uploads/2015/03/medical_kit_checklist_-_full_release.pdf) | p1, Objective | "To provide a contents list of each medical pack including medications, potential medication side effects, other contents, locations, and supportive information." | A |
| d1b | [ISS Medical Checklist 3.001 Medical Kit - Contents and Reference (MED CL/SpX-6 - ALL/FIN/T), 09 APR 15](https://www.nasa.gov/wp-content/uploads/2015/03/medical_kit_checklist_-_full_release.pdf) | Table 1 header, p2 | "Possible Side Effects" | A |
| d1n | [OCHMO-TB-044, Medical Operations, NASA-STD-3001 Technical Brief (08/13/2025)](https://www.nasa.gov/wp-content/uploads/2025/08/ochmo-tb-044-medical-operations.pdf) | Roles, p3 | "Demonstrate proficiency in all medical procedures in JSC 48522 IMG Medical checklist" | A |
| d1c | [OCHMO-MTB-004 Rev A, Space Adaptation Sickness (SAS) and Space Readaptation Syndrome, NASA-STD-3001 Medical Technical Brief (09/25/2025)](https://www.nasa.gov/wp-content/uploads/2025/09/ochmo-mtb-004-space-adaptation-sickness-sas.pdf) | Background, p4 | "The prevention or treatment of SAS is determined per discretion of crew in coordination with their flight surgeon." | A |
| d1d | [OCHMO-TB-006, Pharmaceuticals, NASA-STD-3001 Medical Technical Brief](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-006-pharmaceuticals.pdf) | p7 | "Crewmembers are able to take certain medications (mainly over-the-counter) without discussing with their flight surgeon" | A |
| d1e | [OCHMO-TB-006, Pharmaceuticals, NASA-STD-3001 Medical Technical Brief](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-006-pharmaceuticals.pdf) | p7, Dose Tracker | "An average of 453 medication uses were reported per crewmember during their missions" | A |
| d1f | [Evidence Report: Risk of Adverse Health Outcomes and Decrements in Performance due to In-Flight Medical Conditions (NASA HRP, 2017, NTRS 20170004604)](https://ntrs.nasa.gov/api/citations/20170004604/downloads/20170004604.pdf) | Section C.1, Selection of the Physician Astronaut, p34 | "this individual may or may not have had any prior medical training or experience" | A |
| d1g | [Evidence Report: Risk of Adverse Health Outcomes and Decrements in Performance due to In-Flight Medical Conditions (NASA HRP, 2017, NTRS 20170004604)](https://ntrs.nasa.gov/api/citations/20170004604/downloads/20170004604.pdf) | Section C.1, p34 | "this medical officer receives approximately 40 hours of instruction in the use of onboard resources" | A |
| d1h | [Evidence Report: Risk of Adverse Health Outcomes and Decrements in Performance due to In-Flight Medical Conditions (NASA HRP, 2017, NTRS 20170004604)](https://ntrs.nasa.gov/api/citations/20170004604/downloads/20170004604.pdf) | Section C.1, p34 | "all crew medical officers are provided guidance regarding clinical indications to involve telemedical intervention and ground medical support" | A |
| d1i | [Evidence Report: Risk of Adverse Health Outcomes and Decrements in Performance due to In-Flight Medical Conditions (NASA HRP, 2017, NTRS 20170004604)](https://ntrs.nasa.gov/api/citations/20170004604/downloads/20170004604.pdf) | Decision Support and Onboard Knowledge Resources, p32 | "communication delays or blackouts may limit the ability for ground-based support to assist crew decision-making" | A |
| d1m | [OCHMO-TB-007, Mission Duration, NASA-STD-3001 Technical Brief](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-007-mission-duration.pdf) | Background, p3 | "the communication delay of up to 40 minutes between the crew and ground support back on Earth" | A |
| d1j | [Evidence Report: Risk of Adverse Health Outcomes and Decrements in Performance due to In-Flight Medical Conditions (NASA HRP, 2017, NTRS 20170004604)](https://ntrs.nasa.gov/api/citations/20170004604/downloads/20170004604.pdf) | Decision Support and Onboard Knowledge Resources, p33 | "providing decision support regarding best treatment options, ideal medication and dosing information, and similar" | A |
| d1k | [Evidence Report: Risk of Adverse Health Outcomes and Decrements in Performance due to In-Flight Medical Conditions (NASA HRP, 2017, NTRS 20170004604)](https://ntrs.nasa.gov/api/citations/20170004604/downloads/20170004604.pdf) | Decision Support and Onboard Knowledge Resources, p33 | "there is a need for significant development of these technological advances before such techniques are clinically robust enough" | A |
| d1l | [Evidence Report: Risk of Adverse Health Outcomes and Decrements in Performance due to In-Flight Medical Conditions (NASA HRP, 2017, NTRS 20170004604)](https://ntrs.nasa.gov/api/citations/20170004604/downloads/20170004604.pdf) | Section C.1, p34 | "NASA standards require a designated medical officer, trained to the level of a physician" | A |
| d1o | [OCHMO-TB-006, Pharmaceuticals, NASA-STD-3001 Medical Technical Brief](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-006-pharmaceuticals.pdf) | p2 | "Medications for spaceflight are chosen based on individual crewmember needs, clinical practice guidelines, flight surgeon expertise" | A |

## 3. Thresholds: "act now" vs "watch"

**Question.** Which readings are "act now" and which are "watch" for HR, BP, SpO2, temperature, glucose, CO2 symptoms, radiation and pain, with the source and condition?

### What the sources say

- NO spaceflight-specific vital sign action thresholds were found. NOT FOUND in: OCHMO technical briefs index, NASA-STD-3001 Vol 1 Appendix E, HRP 2017 in-flight medical conditions evidence report, OCHMO-MTB-004. The ISS medical checklist that may hold them is not public.
- The best validated general tool found is NEWS2 from the Royal College of Physicians [d3a]. It was built for adults in hospital on Earth [d3g]. Grade C for our use.
- ISS cabin pressure is close to sea level [d3h], so the NEWS2 room-air oxygen scale is a reasonable starting point on ISS. For lower-pressure exploration cabins: NOT FOUND.
- In-flight baselines differ from ground values (see the teammate file `baselines-inflight.csv`). NEWS2 bands are absolute and will not move with those shifts.

### Proposed table

"Act now" means call the flight surgeon at once and open the matching emergency card. "Watch" means repeat the reading, log it, and send it with the next case.

| Reading (key) | Watch | Act now | Condition | Source | Grade |
| --- | --- | --- | --- | --- | --- |
| heartRate | 41 to 50, or 91 to 130 bpm (NEWS2 score 1 or 2) | 40 or below, or 131 or above (NEWS2 score 3) | At rest, adult, Earth hospital scale | [d3a] [d3e] | C |
| systolicBP | 91 to 110 mmHg (score 1 or 2) | 90 or below, or 220 or above (score 3) | Same | [d3b] [d3e] | C |
| diastolicBP | NOT FOUND (NEWS2 does not score it) | NOT FOUND | | | ? |
| oxygenSat | 92 to 95 % on air (score 1 or 2) | 91 % or below on air (score 3) | Room air, near sea-level cabin (ISS) | [d3c] [d3h] | C |
| temperatureC | 35.1 to 36.0, or 38.1 to 39.0 °C (score 1); 39.1 or above (score 2) | 35.0 °C or below (score 3) | Same | [d3d] | C |
| Total NEWS2 | 1 to 4 | Any single score of 3; total 5 or more is urgent; total 7 or more is emergency | NEWS2 response chart | [d3e] [d3f] | C |
| bloodGlucose | NOT FOUND for a non-diabetic crew member | Below 70 mg/dL is the low level NIDDK gives for people with diabetes | Diabetes guidance, not crew-specific | [d3i] | C |
| Cabin CO2 (no key yet) | Above the 3 mmHg 1-hour design limit; symptoms reported from 2.3 mmHg | NOT FOUND as a crew action number. Use symptom red flags (headache card). Nausea and fatigue reported above 4.5 mmHg | Vehicle design limit and ISS reports | [d3j] [d3l] [d3k] [d3p] | A |
| radiationRate | NOT FOUND as a dose-rate alarm value in sources read (section 8 owns this) | Ground or vehicle warning of a solar particle event: shelter | NASA exposure limits are per event and per career, in mSv, not a rate | [d3m] [d3n] [d3o] | A |
| painScore | NOT FOUND | NOT FOUND. Use the red flags on each card instead of a number | | | ? |

Respiration rate and new confusion are part of NEWS2 but have no key in `keys.ts`. Use `respiratoryRate` (already proposed in new-measurement-keys.csv) and add `newConfusion` (yes/no) so the score can be complete.

### Recommendation

1. Use NEWS2 bands as the absolute floor for "act now" for heartRate, systolicBP, oxygenSat and temperatureC, labeled in the app as "general hospital scale, not spaceflight-validated".
2. Keep the personal-baseline anomaly engine for "watch", since in-flight baselines shift. An absolute NEWS2 score 3 should alert even when the baseline is bad.
3. Do not invent values where this table says NOT FOUND. Show "no limit set" for diastolicBP, glucose high side, pain and radiation rate.
4. For CO2, treat it as a cabin problem: when the value is above the 3 mmHg design limit or several crew have headaches, alert everyone, not one person.
5. Every threshold row is safety-critical and needs a flight surgeon or clinician to sign off before it ships.

| ref | source | section | verbatim quote | confidence |
| --- | --- | --- | --- | --- |
| d3a | [Royal College of Physicians, National Early Warning Score (NEWS) 2, Chart 1: The NEWS scoring system (2017)](https://www.rcp.ac.uk/media/alxev00t/news2-chart-1_the-news-scoring-system_0_0.pdf) | Chart 1 | "Pulse (per minute) / ≤40 / / 41–50 / 51–90 / 91–110 / 111–130 / ≥131" | C |
| d3b | [Royal College of Physicians, National Early Warning Score (NEWS) 2, Chart 1: The NEWS scoring system (2017)](https://www.rcp.ac.uk/media/alxev00t/news2-chart-1_the-news-scoring-system_0_0.pdf) | Chart 1 | "Systolic blood pressure (mmHg) / ≤90 / 91–100 / 101–110 / 111–219 / / / ≥220" | C |
| d3c | [Royal College of Physicians, National Early Warning Score (NEWS) 2, Chart 1: The NEWS scoring system (2017)](https://www.rcp.ac.uk/media/alxev00t/news2-chart-1_the-news-scoring-system_0_0.pdf) | Chart 1 | "SpO2 Scale 1 / ≤91 (%) / 92–93 / 94–95 / ≥96" | C |
| d3d | [Royal College of Physicians, National Early Warning Score (NEWS) 2, Chart 1: The NEWS scoring system (2017)](https://www.rcp.ac.uk/media/alxev00t/news2-chart-1_the-news-scoring-system_0_0.pdf) | Chart 1 | "Temperature (°C) / ≤35.0 / / 35.1–36.0 / 36.1–38.0 / 38.1–39.0 / ≥39.1" | C |
| d3e | [Royal College of Physicians, NEWS2 Chart 4: Clinical response to the NEWS trigger thresholds (2017)](https://www.rcp.ac.uk/media/mrllczrj/news2-chart-4_clinical-response-to-news-trigger-thresholds_0.pdf) | Chart 4 | "3 in single parameter" | C |
| d3f | [Royal College of Physicians, NEWS2 Chart 4: Clinical response to the NEWS trigger thresholds (2017)](https://www.rcp.ac.uk/media/mrllczrj/news2-chart-4_clinical-response-to-news-trigger-thresholds_0.pdf) | Chart 4 | "Emergency response threshold" | C |
| d3g | [Royal College of Physicians, National Early Warning Score (NEWS) 2 resource page](https://www.rcp.ac.uk/resources/national-early-warning-score-news-2/) | How NEWS works | "when patients present to, or are being monitored in hospital" | C |
| d3h | [Ranking of Medical Conditions by Probability (NASA IMM Data Request Report, iMED v5.0, dated 2 Feb 2015, linked from NASA IMM Overview page)](https://www.nasa.gov/wp-content/uploads/2026/08/ranking-of-medical-conditions-by-probability.pdf) | Background, p1 | "vehicle ambient atmosphere equal to approximately 14.7 psi terrestrial ambient atmosphere" | A |
| d3i | [NIDDK, Low Blood Glucose (Hypoglycemia)](https://www.niddk.nih.gov/health-information/diabetes/overview/preventing-problems/low-blood-glucose-hypoglycemia) | What should I do if I have low blood glucose | "If your blood glucose level is below your target or less than 70 mg/dL, follow these steps" | C |
| d3j | [OCHMO-TB-004 Rev D, Carbon Dioxide (CO2), NASA-STD-3001 Technical Brief](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf) | Background, p4 | "limits the average 1-hour CO2 partial pressure (ppCO2) in the habitable volume to no more than 3 mmHg" | A |
| d3k | [OCHMO-TB-004 Rev D, Carbon Dioxide (CO2), NASA-STD-3001 Technical Brief](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf) | Background, p4 | "Fatigue malaise, decreased sleep, and nausea reported at levels above 4.5 mmHg." | A |
| d3l | [Law and Alexander, CO2 on the International Space Station: An Operations Update (NASA JSC abstract, NTRS 20150019624)](https://ntrs.nasa.gov/api/citations/20150019624/downloads/20150019624.pdf) | Case presentation | "In recent ISS expeditions, crewmembers have noted symptoms attributable to CO2 starting at 2.3 mmHg." | A |
| d3p | [OCHMO-TB-004 Rev D, Carbon Dioxide (CO2), NASA-STD-3001 Technical Brief](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf) | Background, CO2-induced headaches, p5 | "To keep the risk of headache below 1%, average 7-day CO2 needs to be maintained below 2.5 mmHg" | A |
| d3m | [OCHMO-TB-020, Design for Ionizing Radiation Protection, NASA-STD-3001 Technical Brief](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-020-radiation-protection.pdf) | Executive Summary, p1 | "short-term radiation exposure to solar particle events is limited to an effective dose of 250 mSv per event" | A |
| d3n | [OCHMO-TB-020, Design for Ionizing Radiation Protection, NASA-STD-3001 Technical Brief](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-020-radiation-protection.pdf) | p4, [V1 4030] | "total career effective radiation dose due to spaceflight radiation exposure shall be less than 600 mSv" | A |
| d3o | [OCHMO-TB-020, Design for Ionizing Radiation Protection, NASA-STD-3001 Technical Brief](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-020-radiation-protection.pdf) | Background, p2 | "timely reporting to alert crew to seek shelter are essential for crew safety" | A |

Note: NEWS2 quotes keep the dash characters used in the original chart.


## 2. What the app may say when the ground is unreachable

**Question.** What do NASA and ESA procedures tell the crew to do when they cannot reach the ground?

### What the sources say

1. The 2001 ISS medical checklist puts the same note at the top of 31 procedures, including burns, cuts, motion sickness, eye problems and pain relief: begin treatment during loss of signal, then call the surgeon as soon as possible [d2a]. This is the only explicit loss-of-signal rule we found. It is from 2001 and is historical.
2. The same note says to contact the surgeon before giving any medicine marked with an asterisk [d2b]. So in 2001 the starred medicines needed the ground, while first aid and the procedure steps did not.
3. Emergency procedures in that checklist (choking, smoke inhalation, CPR) are written as steps the crew does at once, with no wait for the ground.
4. Before a private medical conference, the checklist has the crew write down the symptoms, how long they have lasted, medicines taken and vital signs [d2e], and keep the checklist and kits within reach [d2f]. That is a ready-made handoff packet.
5. NASA operations have relied almost fully on real-time help from the ground [d2c]. Delays or blackouts can stop that help [d1i], and a delay can reach 40 minutes [d1m]. Sudden incapacitating events can quickly put a mission at risk [d2g]. NASA says decision support tools are not yet robust enough [d1k].

NOT FOUND: a current (post-2001) public ISS, Artemis or ESA rule for what crew may do without the ground; any ESA crew medical procedure. Looked in: OCHMO technical brief index, NASA-STD-3001 Appendix E, HRP 2017 evidence report, ESA web search, the public 2015 kit list.

### Options

| Option | What the app does with no link | For | Against |
| --- | --- | --- | --- |
| A. Block | Shows "contact the ground" only | Simplest | Leaves the crew with nothing in a choking, fire or bleeding emergency. Conflicts with the 2001 rule. |
| B. First aid only (recommended) | Shows the card first aid and the time limits. Never shows doses or medicine choices beyond "use only as the flight surgeon directs". Builds the handoff packet. | Matches the 2001 "begin treatment, then call" rule. Keeps medicines with the ground. | Needs clear labeling of what is first aid and what needs the ground. |
| C. Full autonomy | Suggests medicines and next steps | Helps on Mars-length delays | No current NASA source supports this for a non-physician crew. NASA says the tools are not robust yet. |

### Recommendation

1. Use option B. When the link is down, show the card first aid, red flags and time limits as normal.
2. Show one banner: "No link. Start first aid now. Send the case as soon as the link returns." This copies the 2001 rule.
3. Keep every medicine step as "only as the flight surgeon directs", even with no link. This matches the starred-medicine note.
4. Build the handoff packet from the 2001 PMC list: symptoms, how long, what makes it better or worse, medicines taken, effect on work, last meal, pulse, blood pressure, breathing rate, temperature and oxygen level. Time-stamp every entry.
5. Each card already carries a `whenGroundUnavailable` field with the steps that need no ground and the source for each.
6. This item is safety-critical and needs flight surgeon sign-off.

| ref | source | section | verbatim quote | confidence |
| --- | --- | --- | --- | --- |
| d2a | [ISS Integrated Medical Group (IMG) Medical Checklist, JSC-48522-E4, 2001 (NASA JSC; original nasa.gov URL returns 404, archived copy; also mirrored at newspaceeconomy.ca). Historical, not the current checklist.](https://web.archive.org/web/20230519222418/https://www.nasa.gov/centers/johnson/pdf/163533main_ISS_Med_CL.pdf) | Header NOTE on 31 procedures, e.g. BURNS p.325, LACERATION - REPAIR p.823, MOTION SICKNESS p.395 (PDF pages) | "In an emergency or during Loss of Signal, begin appropriate treatment; then call Surgeon as soon as possible." | A |
| d2b | [ISS Integrated Medical Group (IMG) Medical Checklist, JSC-48522-E4, 2001 (NASA JSC; original nasa.gov URL returns 404, archived copy; also mirrored at newspaceeconomy.ca). Historical, not the current checklist.](https://web.archive.org/web/20230519222418/https://www.nasa.gov/centers/johnson/pdf/163533main_ISS_Med_CL.pdf) | Same header NOTE, e.g. BURNS, PDF p.325 | "Contact Surgeon before giving any medication marked with an asterisk." | A |
| d2c | [OCHMO-TB-007, Mission Duration, NASA-STD-3001 Technical Brief](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-007-mission-duration.pdf) | Effects of Communication Delays in Long-Duration Space Flight Missions, p3 | "near-complete real-time dependence on experts on the ground" | A |
| d2e | [ISS Integrated Medical Group (IMG) Medical Checklist, JSC-48522-E4, 2001 (NASA JSC; original nasa.gov URL returns 404, archived copy; also mirrored at newspaceeconomy.ca). Historical, not the current checklist.](https://web.archive.org/web/20230519222418/https://www.nasa.gov/centers/johnson/pdf/163533main_ISS_Med_CL.pdf) | PRIVATE MEDICAL CONFERENCE: PMC, PDF p.441 | "Prior to calling a PMC 1. Assess nature of problem" | A |
| d2f | [ISS Integrated Medical Group (IMG) Medical Checklist, JSC-48522-E4, 2001 (NASA JSC; original nasa.gov URL returns 404, archived copy; also mirrored at newspaceeconomy.ca). Historical, not the current checklist.](https://web.archive.org/web/20230519222418/https://www.nasa.gov/centers/johnson/pdf/163533main_ISS_Med_CL.pdf) | PRIVATE MEDICAL CONFERENCE: PMC, PDF p.441 | "Have ISS MED C/L, AMP, and ALSP within reach." | A |
| d2g | [Evidence Report: Risk of Adverse Health Outcomes and Decrements in Performance due to In-Flight Medical Conditions (NASA HRP, 2017, NTRS 20170004604)](https://ntrs.nasa.gov/api/citations/20170004604/downloads/20170004604.pdf) | p52 | "sudden, incapacitating medical events can rapidly compromise the success of a mission" | A |
| d1i | [Evidence Report: Risk of Adverse Health Outcomes and Decrements in Performance due to In-Flight Medical Conditions (NASA HRP, 2017, NTRS 20170004604)](https://ntrs.nasa.gov/api/citations/20170004604/downloads/20170004604.pdf) | Decision Support and Onboard Knowledge Resources, p32 | "communication delays or blackouts may limit the ability for ground-based support to assist crew decision-making" | A |
| d1m | [OCHMO-TB-007, Mission Duration, NASA-STD-3001 Technical Brief](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-007-mission-duration.pdf) | Background, p3 | "the communication delay of up to 40 minutes between the crew and ground support back on Earth" | A |
| d1k | [Evidence Report: Risk of Adverse Health Outcomes and Decrements in Performance due to In-Flight Medical Conditions (NASA HRP, 2017, NTRS 20170004604)](https://ntrs.nasa.gov/api/citations/20170004604/downloads/20170004604.pdf) | Decision Support and Onboard Knowledge Resources, p33 | "there is a need for significant development of these technological advances before such techniques are clinically robust enough" | A |

## 4. Disclaimers and liability wording

**Question.** What disclaimer wording do comparable tools use?

### What the sources say

1. Every OCHMO technical brief page says the brief is for reference only [d4a] and does not override agency, program or contract rules [d4b].
2. The NASA Human Research Roadmap condition pages say the linked ISS checklist does not show current capabilities [d4c].
3. MedlinePlus says NLM does not intend to give specific medical advice [d4h].
4. US FDA guidance (January 2026): software that gives recommendations to patients or caregivers, not health care professionals, is a device [d4d]. Software escapes device rules only when a professional can review the basis of each recommendation [d4g]. FDA warns about automation bias, meaning people trust a machine suggestion too much [d4f], and says it gets worse when action is urgent [d4e].
5. Spaceflight hardware is not regulated by FDA in the same way; we found no source saying how FDA rules apply on orbit. We use the guidance only as a model for safe design, not as a legal claim.

NOT FOUND: the disclaimer text inside the current ISS medical checklist; any NASA or ESA wording for crew-facing medical software; disclaimer wording from a named telemedicine app that we could quote. Looked in: OCHMO brief index, NTRS, HRR condition pages.

### Options

| Option | Wording style | For | Against |
| --- | --- | --- | --- |
| A. One splash screen | Long legal text at start | Common in consumer apps | Crew will skip it. Not seen in the moment of use. |
| B. Short line on every card plus a source line (recommended) | "Working idea only. This is not a diagnosis." on each item, plus who wrote it and when | Matches the OCHMO "reference only" pattern. Fights automation bias at the moment of use. | Slightly more text on screen. |
| C. No disclaimer | | | Hides the limits of the tool. |

### Recommendation

1. Use option B. Keep the line "Working idea only. This is not a diagnosis." on every differential item. The cards already do this.
2. Show a source line on every card: who wrote it, the date, and "not a NASA procedure". The `sourceNote` field already holds this.
3. Show the evidence behind each step (the source quote) one tap away. This follows the FDA idea that the user should be able to check the basis.
4. Add a short app-wide line: "For reference only. It does not replace the flight surgeon or the mission medical checklist."
5. Do not claim FDA status or NASA approval anywhere.

| ref | source | section | verbatim quote | confidence |
| --- | --- | --- | --- | --- |
| d4a | [OCHMO-TB-044, Medical Operations, NASA-STD-3001 Technical Brief (08/13/2025)](https://www.nasa.gov/wp-content/uploads/2025/08/ochmo-tb-044-medical-operations.pdf) | Footer on every page, e.g. p2 | "This Technical Brief is derived from NASA-STD-3001 and is for reference only." | A |
| d4b | [OCHMO-TB-044, Medical Operations, NASA-STD-3001 Technical Brief (08/13/2025)](https://www.nasa.gov/wp-content/uploads/2025/08/ochmo-tb-044-medical-operations.pdf) | Footer on every page, e.g. p2 | "It does not supersede or waive existing Agency, Program, or Contract requirements." | A |
| d4c | [NASA Human Research Roadmap, HumanResearchWiki: Choking/Obstructed Airway (printed 6/14/2016)](https://humanresearchroadmap.nasa.gov/Evidence/medicalConditions/Choking_Obstructed_Airway.pdf) | Initial Treatment Steps During Space Flight, p2 | "Please note that this version does not represent current diagnostic or treatment capabilities available on the ISS." | A |
| d4h | [MedlinePlus (NLM), Disclaimers](https://medlineplus.gov/disclaimers.html) | Disclaimers | "It is not the intention of NLM to provide specific medical advice" | B |
| d4d | [US FDA, Clinical Decision Support Software, Guidance for Industry and FDA Staff (issued January 29, 2026)](https://www.fda.gov/media/109618/download) | Section IV, Criterion 3, p13 | "Software functions that support or provide recommendations to patients or caregivers – not HCPs – meet the definition of a device." | A |
| d4g | [US FDA, Clinical Decision Support Software, Guidance for Industry and FDA Staff (issued January 29, 2026)](https://www.fda.gov/media/109618/download) | Section III, p6 | "intended for the purpose of enabling such health care professional to independently review the basis for such recommendations" | A |
| d4f | [US FDA, Clinical Decision Support Software, Guidance for Industry and FDA Staff (issued January 29, 2026)](https://www.fda.gov/media/109618/download) | Section IV, Criterion 4, p15 | "Automation bias is the propensity of humans to over-rely on a suggestion from an automated system." | A |
| d4e | [US FDA, Clinical Decision Support Software, Guidance for Industry and FDA Staff (issued January 29, 2026)](https://www.fda.gov/media/109618/download) | Section IV, Criterion 4, p15 | "In situations that require urgent action, automation bias increases because there is not sufficient" | A |

## 5. Lone, injured or incapacitated crew member

**Question.** What must the app support when one crew member is alone, the medical officer is the patient, or the patient cannot use the app?

### What the sources say

1. ISS trains two crew medical officers for each increment [d5c]. So the medical officer can be the patient, and a second trained person may still be on board.
2. The officer may have no medical background [d1f]. Long missions face a lack of fully trained medical staff [d5d].
3. The microgravity CPR guideline says airway management needs at least two rescuers and a restrained patient [d5a]. For immediate basic life support it names a method one rescuer can use [d5b].
4. Crew can take some mainly over-the-counter medicines without talking to the flight surgeon [d1d], so self-care is normal.
5. Sudden incapacitating events can quickly put a mission at risk [d2g].

NOT FOUND: any NASA or ESA rule for a crew member who is alone in a module during an emergency; how a choking crew member alone should self-rescue in flight; how many crew must stay with a patient. Looked in: OCHMO briefs, HRP 2017, Hinkelbein 2020, 2001 ISS checklist.

### Options

| Option | Support | For | Against |
| --- | --- | --- | --- |
| A. Assume a helper always | Steps written for a rescuer | Simpler | Fails when the patient is alone or is the medical officer. |
| B. Two modes (recommended) | "I am the patient" and "I am helping someone" | Fits self-care and the two-officer setup | More screens to test. |
| C. Full voice and hands-free | Voice prompts, large buttons | Good for hands busy with pressure or CPR | Big build effort for a hackathon. |

### Recommendation

1. Start every case with one question: "Who needs help: me, or someone else?"
2. In "me" mode, show only steps a person can do alone. Put "call a crew member now" at the top for any life-threat red flag.
3. In "someone else" mode, show "call all crew" first for choking, fire, heavy bleeding and passing out. Flag steps that need two people (airway management, restraining for CPR).
4. Never let the patient be the only one who confirms a red flag when they may be confused. Ask the helper to confirm.
5. Use large buttons and one action per screen during emergencies, since hands may be busy holding pressure. Voice is a later option.
6. Log who entered each reading (patient or helper) with the time, for the handoff.
7. This item is safety-critical and needs flight surgeon sign-off.

| ref | source | section | verbatim quote | confidence |
| --- | --- | --- | --- | --- |
| d5c | [OCHMO-TB-044, Medical Operations, NASA-STD-3001 Technical Brief (08/13/2025)](https://www.nasa.gov/wp-content/uploads/2025/08/ochmo-tb-044-medical-operations.pdf) | Roles, p3 | "Program designates/trains two CMOs for each increment." | A |
| d1f | [Evidence Report: Risk of Adverse Health Outcomes and Decrements in Performance due to In-Flight Medical Conditions (NASA HRP, 2017, NTRS 20170004604)](https://ntrs.nasa.gov/api/citations/20170004604/downloads/20170004604.pdf) | Section C.1, Selection of the Physician Astronaut, p34 | "this individual may or may not have had any prior medical training or experience" | A |
| d5d | [Evidence Report: Risk of Adverse Health Outcomes and Decrements in Performance due to In-Flight Medical Conditions (NASA HRP, 2017, NTRS 20170004604)](https://ntrs.nasa.gov/api/citations/20170004604/downloads/20170004604.pdf) | p5 | "a lack of comprehensively trained medical personnel" | A |
| d5a | [Hinkelbein et al. 2020, CPR during spaceflight: a guideline for CPR in microgravity (DGLRM and ESAM-SMG), Scand J Trauma Resusc Emerg Med 28:108](https://pmc.ncbi.nlm.nih.gov/articles/PMC7607644/) | Abstract, Results | "Airway management should only be performed if at least two rescuers are present and the patient has been restrained." | A |
| d5b | [Hinkelbein et al. 2020, CPR during spaceflight: a guideline for CPR in microgravity (DGLRM and ESAM-SMG), Scand J Trauma Resusc Emerg Med 28:108](https://pmc.ncbi.nlm.nih.gov/articles/PMC7607644/) | Abstract, Results | "In immediate BLS, the chest compression method of choice is the Evetts-Russomano method (ER)" | A |
| d1d | [OCHMO-TB-006, Pharmaceuticals, NASA-STD-3001 Medical Technical Brief](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-006-pharmaceuticals.pdf) | p7 | "Crewmembers are able to take certain medications (mainly over-the-counter) without discussing with their flight surgeon" | A |
| d2g | [Evidence Report: Risk of Adverse Health Outcomes and Decrements in Performance due to In-Flight Medical Conditions (NASA HRP, 2017, NTRS 20170004604)](https://ntrs.nasa.gov/api/citations/20170004604/downloads/20170004604.pdf) | p52 | "sudden, incapacitating medical events can rapidly compromise the success of a mission" | A |

## 6. Privacy rules for crew health data

**Question.** What privacy rules apply to crew health data, and what is sent to Earth?

### What the sources say

1. NASA follows the Privacy Act of 1974 for medical information [d6a]. Release of in-flight operational and research data is managed under the Privacy Act and NASA research subject rules [d6d].
2. Partner agencies may add their own rules for their crew [d6b], and partner agencies have access to their own crew health information [d6c].
3. ISS has private medical conferences [d6f], and the biomedical engineer coordinates private medical and psychological family conferences [d6e]. So some health talk is private between crew member and surgeon.
4. The 2001 PMC page lists what the crew gathers before that private call [d2e].

NOT FOUND: the exact list of medical data downlinked from ISS; encryption or channel rules for medical data; ESA or JAXA privacy rules for crew medical data. Looked in: OCHMO-TB-044, HRP 2017, NASA-STD-3001 Appendix E. Section 10 (comms) may add to this.

### Options

| Option | Data rule | For | Against |
| --- | --- | --- | --- |
| A. Share everything with all crew | Open screen | Simple | Breaks the private conference model. |
| B. Private by default, sent only to the flight surgeon (recommended) | Each crew member sees their own data. Handoff goes to the surgeon as a private packet. | Matches Privacy Act handling and private conferences | Commander may need a fitness-for-duty signal. |
| C. Nothing leaves the station | | Most private | Breaks the handoff, which is the point of the app. |

### Recommendation

1. Use option B. Keep each crew member's data private to them on the station.
2. Send the handoff packet to the flight surgeon only, marked private medical.
3. Let the app show other crew only a red-flag alert ("crew member needs help") during an emergency, not the details.
4. Keep data on the station device. Do not send it anywhere other than the surgeon channel.
5. Add a setting per partner agency, since partners may add their own rules.
6. Write down what the packet contains so crew know what is sent.

| ref | source | section | verbatim quote | confidence |
| --- | --- | --- | --- | --- |
| d6a | [OCHMO-TB-044, Medical Operations, NASA-STD-3001 Technical Brief (08/13/2025)](https://www.nasa.gov/wp-content/uploads/2025/08/ochmo-tb-044-medical-operations.pdf) | Handling of Medical Information, p16 | "Provisions of Privacy Act of 1974 is strictly followed." | A |
| d6d | [OCHMO-TB-044, Medical Operations, NASA-STD-3001 Technical Brief (08/13/2025)](https://www.nasa.gov/wp-content/uploads/2025/08/ochmo-tb-044-medical-operations.pdf) | Handling of Medical Information, p16 | "Release of pre-, in-, and post-flight operational and research data will be managed per Privacy Act of 1974" | A |
| d6b | [OCHMO-TB-044, Medical Operations, NASA-STD-3001 Technical Brief (08/13/2025)](https://www.nasa.gov/wp-content/uploads/2025/08/ochmo-tb-044-medical-operations.pdf) | Handling of Medical Information, p16 | "IPs may levy supplemental requirements regarding handling of medical info for their crew." | A |
| d6c | [OCHMO-TB-044, Medical Operations, NASA-STD-3001 Technical Brief (08/13/2025)](https://www.nasa.gov/wp-content/uploads/2025/08/ochmo-tb-044-medical-operations.pdf) | Handling of Medical Information, p16 | "IP organizations have access to crew health info" | A |
| d6f | [OCHMO-TB-044, Medical Operations, NASA-STD-3001 Technical Brief (08/13/2025)](https://www.nasa.gov/wp-content/uploads/2025/08/ochmo-tb-044-medical-operations.pdf) | In-flight evaluations table, p5 | "Private Medical Conferences (PMC)" | A |
| d6e | [OCHMO-TB-044, Medical Operations, NASA-STD-3001 Technical Brief (08/13/2025)](https://www.nasa.gov/wp-content/uploads/2025/08/ochmo-tb-044-medical-operations.pdf) | Roles, p3 | "coordinate private medical/psychological family conferences" | A |
| d2e | [ISS Integrated Medical Group (IMG) Medical Checklist, JSC-48522-E4, 2001 (NASA JSC; original nasa.gov URL returns 404, archived copy; also mirrored at newspaceeconomy.ca). Historical, not the current checklist.](https://web.archive.org/web/20230519222418/https://www.nasa.gov/centers/johnson/pdf/163533main_ISS_Med_CL.pdf) | PRIVATE MEDICAL CONFERENCE: PMC, PDF p.441 | "Prior to calling a PMC 1. Assess nature of problem" | A |
