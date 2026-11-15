# Pulseframe research requests

Purpose: replace every assumed fact in the app with a sourced one, so the app still makes sense in a real spaceflight medical emergency and for daily health tracking by crew who are **not doctors**.

Written 2026-11-15. Audience: the researcher. Read "How to deliver" first.

## 0. What the repo assumes today (and why it needs research)

| Assumption in the repo | Where | Problem |
| --- | --- | --- |
| Only 5 kit items, from a 2015 ISS checklist (Convenience Med Pack White) | `src/data/inventory/demoIssKit.ts` | Not a full kit, not current, no equipment (only drugs). `RESEARCHER_KIT` is empty. |
| 2 protocol cards, written by the team, no meds or doses | `src/modules/protocols/cards/*.json` | Differentials and steps are invented demo copy. `candidateItemIds` is empty. |
| "Read X on the onboard monitor" for every test | chest card `tests[]` | We do not know what devices exist, how a layperson uses them, or how microgravity changes the method. |
| 13 measurement keys and their units | `src/contracts/keys.ts` | Missing keys real crews track (weight/mass, hydration, urine, CO2 symptoms, visual acuity, etc.). Unknown which are actually measurable on board. |
| No vital-sign limits at all | `src/data/demoBounds.ts` | Anomaly engine only compares to a personal baseline. A crew member with a bad baseline would never alert. Need cited absolute limits and microgravity-adjusted ranges. |
| Personal-baseline z-score with 3 day burn-in, 7 day window | `src/data/anomaly.ts` | Team's own choice. Need to know whether this is reasonable given adaptation in the first days/weeks of flight. |
| Daily checklist (vitamin D, ARED hour, treadmill 30 min, etc.) | `src/data/checklistTemplate.ts`, `workoutPlan.ts` | Times, durations and items are demo values. |
| Radiation unit µGy/h, simulated "CAD" series | `keys.ts`, plan | Unit choice, thresholds and what crew can actually read are unverified. |
| Psych check = 4 self-report scales | `src/modules/psych` | Not a validated instrument. |
| App never gives a dose | plan, `GivenDialog` | In a comms blackout nobody can "enter what the flight surgeon directed". Need to know what is realistic and safe. This is a product decision (see section 9). |
| Comms always eventually reach Earth (store-and-forward) | `src/data/sync.ts` | Need real delay, blackout and bandwidth numbers, and what a crew does when Earth cannot answer. |

The challenge text itself: <https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=details>. Please read it fully and add anything in it that this document misses. (I could not load that page from my tooling, so I worked from the README and plan.)

## 1. How to deliver (read this)

The app and the developers can only use research in a fixed shape. Do not send essays.

1. **One file per topic**, named exactly as in the "Deliver as" line of each topic. JSON or CSV preferred, shared as a Google Sheet plus an export, or committed to `docs/research/` through a PR. If you cannot use git, send the files to Umer on Discord.
2. **Every single fact needs a source**: URL, document title, page or section, date accessed, and a short **verbatim quote** (under 25 words). Rows with no quote are rejected.
3. **Confidence column**: `A` = official NASA/ESA/JAXA/CSA/Roscosmos or peer reviewed paper, `B` = reputable secondary (review article, textbook, agency summary), `C` = general medical source not specific to spaceflight, `?` = could not find. Never fill a gap with a guess. Write `NOT FOUND` and say where you looked.
4. **Verify chatbot output.** Chatbots invent drug names, page numbers and URLs. Open every link yourself. If the quote is not on the page, delete the row. Use the chatbot to find leads and to format, not as a source.
5. **Separate "on the ISS today" from "other"**. Tag each item `iss-current`, `iss-historical`, `artemis-orion`, `gateway`, `mars-design-reference`, `analog`, `general-medicine`. The demo kit is currently historical. Say which environment you are describing.
6. **Plain language rewrite**: for anything a crew member would read, add a `plain` field written at about a 12 year old reading level, one action per sentence.
7. **Mark safety-critical items** with `safety: true` (drug doses, contraindications, resuscitation steps, thresholds). A second person must check those rows.
8. Never paste copyrighted text in bulk. Quotes are short, the rest is your own words.
9. Send a short `RESEARCH-LOG.md` with: what you searched, what you could not find, and open questions for the team.

### Ready-to-use chatbot starter (paste first in every session)

```
You are a research assistant helping build a decision-support app for astronauts who are not doctors, on long-duration missions where Earth cannot always reply. I will ask about spaceflight medicine. Rules: (1) Only state facts you can attach to a specific, real, linkable source (agency document, NTRS record, peer reviewed paper, NASA Human Research Program page). Give the URL, title, section/page and a verbatim quote under 25 words for every fact. (2) If you are not sure a source exists, say "NOT FOUND", never guess or fill in plausible values. (3) Label every item with the environment: ISS current, ISS historical, Artemis/Orion, Gateway, Mars design reference, analog, or general medicine on Earth. (4) Distinguish what a trained physician does from what a layperson can do with the equipment on board. (5) Output as a table or JSON in the exact format I give. (6) End with a list of things you were unable to verify. Confirm you understand, then wait for my first task.
```

Good places to look, for all topics: NASA Technical Reports Server (ntrs.nasa.gov), NASA Human Research Program (nasa.gov/hrp, Human Research Roadmap `humanresearchroadmap.nasa.gov`), NASA Space Medicine Operations Division, NASA-STD-3001 (Space Flight Human-System Standard Vol. 1 crew health and Vol. 2), NASA Evidence Reports and Risk reports (e.g. HRP "Risk of Adverse Health Outcomes and Decrements in Performance Due to Inflight Medical Conditions"), NASA Life Sciences Data Archive, Aerospace Medical Association journal (Aerospace Medicine and Human Performance), npj Microgravity, ESA, Canadian Space Agency, JAXA, DailyMed and PubMed for drug labels, NASA "Space Medicine Exploration Medical Condition List" and the Integrated Medical Model (IMM) documentation, ISS Medical Checklist / "ISS Medical Operations Requirements Document (MORD)" if public, "Space Shuttle/ISS Crew Health Care System (CHeCS)" pages.

---

## 2. Onboard drugs and consumables (the inventory)

**Why:** the Assistant and kit stage can only recommend what is in `ACTIVE_INVENTORY`. Today that is 5 historical items.

**Research:**
- The most current public ISS medical kit contents. Which packs exist (e.g. Convenience Medication Pack, Ambulatory pack, Advanced Life Support Pack, Eye/ENT pack, Respiratory support pack, etc.), what each contains, quantity, strength, route, stowage location, labeled indication, side effects, contraindications.
- Orion / Artemis / Gateway / Mars-design-reference medical kit contents, if public. Say what is not public.
- Drug stability in space: how radiation and long storage shorten shelf life, and how crews are told to treat expired drugs.
- Most-used drugs and typical reasons (the repo cites sleep, pain, congestion, allergy).
- Drug-drug interactions and allergy cross-checks that a layperson can understand (e.g. do not combine two sleep meds, already in the melatonin comment).
- Whether the crew is allowed to self-administer without ground approval, and under which conditions (autonomy rules for medical emergencies).

**Deliver as:** `inventory.json`, an array that matches `InventoryItem` in `src/contracts/types.ts` exactly, plus the extra fields below. Do not rename fields.

```json
{
  "id": "kit-<pack-slug>-<item-slug>",
  "name": "",
  "pack": "",
  "strength": "",
  "route": "",
  "quantityOnBoard": 0,
  "location": "",
  "sideEffects": "",
  "comments": "",
  "sourceUrl": "",
  "provenance": "researcher-list",
  "sourcePage": "",
  "indications": ["labeled uses, plain language"],
  "contraindications": ["plain language"],
  "interactions": ["plain language"],
  "labeledDoseText": "exactly as written in the source, or empty",
  "environment": "iss-current",
  "confidence": "A",
  "quote": "",
  "safety": true
}
```

Rule: use `null` for `quantityOnBoard` when unknown, `""` for unknown text. Do not invent.

**Starter prompt:**
```
Find the most recent publicly available ISS medical kit / Crew Health Care System checklist or inventory from NASA (ISS Medical Checklist, MED CL, NTRS records, NASA Space Medicine). List every pack and every item in each pack: name, strength, route, quantity, stowage location, comments, side effects. Give the source URL, page and a short verbatim quote for each row. Output as a JSON array using these fields: [paste the JSON above]. Tell me the document date. If the document is older than 2020, say so and look for newer ones. Then list which items you could not find in a public source.
```

## 3. Onboard medical equipment and diagnostics (what tests are even possible)

**Why:** every test step in the app says "read it on the onboard monitor". We need the real devices and how a non-doctor uses them. This decides which `MeasurementKey`s are real.

**Research:**
- The full public list of ISS and exploration medical hardware: patient monitor / defibrillator, automated blood pressure cuff, pulse oximeter, thermometer, glucometer, stethoscope, otoscope, ophthalmoscope, tonometer, ultrasound (Ultrasound 2 or later, including the remote-guided ultrasound procedure), Holter/ECG, medical restraint system, IV and suture supplies, dental kit, lab analyzers (e.g. i-STAT / blood chemistry, urinalysis), microbial sampling, air and water quality monitors (CO2, ammonia), personal and area radiation dosimeters, body mass measurement device, scales, stethoscope alternatives. State which are on ISS today, which are for Mars design only.
- For each: what it measures, unit, normal use steps (a layperson version), how microgravity changes the method (positioning, restraint, no weight scale, fluids behave differently), consumables, battery, calibration, data output, how long a reading takes, and known failure modes.
- Self-measurement vs buddy-measurement. Which tests a lone crew member can do on themselves.
- How remote guidance works (ground-guided ultrasound, telemedicine tool names).

**Deliver as:** `equipment.json`:
```json
{
  "id": "eq-<slug>",
  "name": "",
  "measures": ["heartRate"],
  "unit": "",
  "environment": "iss-current",
  "stowage": "",
  "selfUsePossible": true,
  "needsSecondPerson": false,
  "steps": ["one action per step, plain language, microgravity-aware"],
  "microgravityNotes": "",
  "typicalDurationMin": 0,
  "failureModes": ["what to do if the reading is missing or impossible"],
  "sourceUrl": "", "sourcePage": "", "quote": "", "confidence": "A"
}
```
Also deliver `new-measurement-keys.csv`: any measurement a crew can actually take that is **not** in `src/contracts/keys.ts` (name, unit, device, why it matters, normal-in-flight range with source). Candidates to check: body mass, respiratory rate, visual acuity, hydration or urine colour, urine output, CO2 exposure symptoms, grip strength, ECG rhythm, glucose, ketones, pupil response, balance test, cognitive test score.

**Starter prompt:**
```
List every piece of medical diagnostic and treatment equipment that is publicly documented on the International Space Station (Crew Health Care System, CHeCS, Crew Medical Restraint System, Ultrasound, defibrillator/monitor, ocular devices, etc.), plus what is planned for Artemis/Orion/Gateway and Mars mission design references. For each device, give: what it measures or does, who can use it, step-by-step use in plain language, how microgravity changes the procedure, and the source (URL, page, quote). Output as JSON using the schema I paste next. Mark anything that is not publicly documented as NOT FOUND.
```

## 4. Medical factors of spaceflight (the physiology the app must respect)

**Why:** normal ranges on Earth are wrong in space (fluid shift, bradycardia/tachycardia changes, BP, etc.). Alerts and baselines must account for this. Also drives the 5 HRP hazards tagging.

**Research (each with mechanism, time course, measurable signs, countermeasure):**
- Microgravity: fluid shift to head, space adaptation syndrome (first 72 h), cardiovascular deconditioning, muscle atrophy, bone loss, spaceflight-associated neuro-ocular syndrome (SANS), vestibular changes, immune dysregulation, latent virus reactivation, altered drug pharmacokinetics.
- Radiation: GCR and SPE, dose and dose-equivalent units, short- and long-term effects, symptoms of acute radiation sickness (what a crew member could see in the first hours), NASA career and acute limits, how SPE alerts reach the crew.
- Isolation and confinement: sleep, circadian disruption, mood, team conflict, cognitive decline, communication delay effects, behavioural health warning signs.
- Closed environment: CO2 levels and symptoms, air quality, noise, water and food, microbiome, contamination.
- Distance from Earth: communication delay and blackout, no rapid return, resource limits, the need for medical autonomy.
- Exercise countermeasures: the prescription for resistive and aerobic exercise, injury modes.
- Typical changes in vital signs in flight versus ground (mean and spread of HR, BP, SpO2, temperature, sleep hours) with published numbers.

**Deliver as:** `spaceflight-factors.csv` with columns `factor, hazardId (radiation|isolation|distance|gravity|environment), mechanism, onset, measurable_signs, normal_inflight_range_with_unit, warning_signs, countermeasure, source_url, quote, confidence`. Plus `baselines-inflight.csv`: `measurementKey, unit, ground_normal, inflight_typical_mean, inflight_range, population, source_url, quote, confidence`. These feed `src/data/demoBounds.ts` (and replace "demonstration thresholds").

**Starter prompt:**
```
For each NASA Human Research Program hazard (space radiation, isolation and confinement, distance from Earth, altered gravity, hostile/closed environments) summarise the documented health effects on crew, onset time, measurable signs and countermeasures, using NASA HRP Evidence Reports, NTRS and peer reviewed papers. Then give published in-flight versus pre-flight values for heart rate, blood pressure, SpO2, body temperature, sleep duration and blood glucose in long-duration astronauts. Give units, sample size, and sources with a verbatim quote. Say NOT FOUND where the data does not exist.
```

## 5. Likely medical events in space (the emergency protocol library)

**Why:** the app has 2 invented cards. Real emergencies must be ranked by how likely and how dangerous, so we write the right cards first.

**Research:**
- The NASA Integrated Medical Model / Exploration Medical Condition List: the ranked list of conditions, incidence and severity for ISS and exploration missions. Rank by likelihood x consequence.
- Documented ISS inflight events: back pain, headache, motion sickness, nasal congestion, insomnia, skin rash/irritation, eye abrasion and foreign body, minor injuries and burns, urinary retention/infection, kidney stones (and how risk rises), dental problems, gastrointestinal upset and constipation, venous thrombosis (the 2019 jugular vein case), cardiac arrhythmia, anaphylaxis/allergy, toxic exposure (ammonia, smoke, depress), decompression sickness (EVA), fracture and traumatic injury, appendicitis and acute abdomen, infection and sepsis, acute psychiatric crisis, acute radiation illness.
- For each: top signs and symptoms, how a non-doctor decides it is serious ("red flags"), which tests are possible on board, and the event history on ISS and in analogs.

**Deliver as:** `conditions.csv`: `conditionId, name, likelihood_per_mission_or_per_person_year, severity, source_url, quote, regions (head|chest|abdomen|spine|leftArm|rightArm|leftLeg|rightLeg|skin), red_flags, tests_possible_onboard (reference equipment ids), confidence`. Then rank the **top 15** conditions we should turn into protocol cards, with a one-line reason each.

**Starter prompt:**
```
Using NASA's Integrated Medical Model, the Exploration Medical Condition List, NASA Evidence Reports and published ISS case reports, list the medical conditions most likely to occur on long-duration spaceflight, with incidence rate and severity where published. For each, give the body region, red-flag symptoms, and which diagnostics are available on board. Rank the top 15 by likelihood times consequence. Give source URL and a verbatim quote per row. If a number is not public, say NOT FOUND.
```

## 6. Emergency procedures for non-doctors (protocol card content)

**Why:** this is the actual script the app reads to a frightened crew member. It must follow real onboard procedure, not generic first aid.

**Research:** for the top conditions from section 5 (and always these): cardiac arrest and CPR in microgravity (the restraint technique, compression method, defibrillator use), choking, severe bleeding, burns, eye injury, anaphylaxis, fracture splinting, loss of consciousness, severe allergic reaction, chest pain, breathing difficulty, severe headache, abdominal pain, toxic atmosphere / fire / depress (crew medical response), radiation event (shelter, dosimeter checks), psychiatric emergency, death or incapacitation of a crewmate and who is "crew medical officer".
- What the NASA/ESA flight rules say about the Crew Medical Officer role, training level, and when to call the ground, and what to do when the ground cannot respond.
- Evacuation and return constraints (time to Earth, for ISS, Artemis and Mars).
- The recommended order of steps, time limits, and decision points.
- Pitfalls of layperson errors in microgravity (e.g. restraint, floating fluids, sharps).

**Deliver as:** one JSON per condition in `protocols/<id>.json`, matching `ProtocolCardSchema` in `src/modules/protocols/schema.ts` exactly (id, title, regionIds, keywords, differential[], tests[], immediateSteps[], candidateItemIds[], cautions, sourceNote), plus extra fields `redFlagsCallGround`, `redFlagsLifeThreat`, `timeLimits`, `whenGroundUnavailable`, `sources[]` (url, quote). `tests[].inputKey` must be a key from `keys.ts` or a new key you proposed in section 3. `candidateItemIds` must be ids from your `inventory.json`. Keep every instruction one action per sentence.

**Starter prompt:**
```
I am writing a step-by-step emergency protocol for an astronaut who is not a doctor. Condition: <CONDITION>. Using NASA and ESA flight medicine documents, NASA Space Medicine, published ISS procedures and peer reviewed spaceflight medicine papers, give: red flags that mean life threat, tests the crew can do with ISS equipment (name each device), immediate steps in order, what changes in microgravity, when to contact the ground, what to do if the ground cannot respond, and which onboard items are used. Write every step as one short plain sentence. Cite each step (URL, section, verbatim quote). Output JSON matching this schema: [paste ProtocolCardSchema]. Flag every dose or number as safety-critical.
```

## 7. Daily health monitoring (routine tracking)

**Why:** the dashboard and checklist assume a daily routine. Need what crews really track, how often, and how a layperson takes each measurement.

**Research:**
- What NASA's in-flight health monitoring includes: periodic health status exams, in-flight medical checks, Flight Surgeon private medical conferences, exercise logging, sleep logging, food/water logging, medication logs, radiation badge reading, blood/urine research collection, weight/mass measurement, eye exams, and their frequency.
- Which daily or weekly self-checks are recommended, with typical durations.
- Realistic daily schedules (exercise 2.5 h/day source, sleep 8 h target, meal times) and "mission day" semantics.
- How to take each daily measurement correctly **in microgravity** (BP cuff position, pulse oximeter, temperature on the skin vs core, glucose).
- What a layperson can do about data quality (bad readings, repeating a measurement, how many repeats).
- Which of these should be personal-baseline tracked, with how many days of baseline are needed.

**Deliver as:** `daily-routine.csv`: `item, kind(meds|vitals|exercise|radiation|psych|other), frequency, typical_time, duration_min, who, device, linkedKey, required, steps_plain, source_url, quote, confidence`. Plus a one-page `baseline-method.md` stating burn-in length, window length and any adaptation to the first weeks of flight, with sources. This replaces `checklistTemplate.ts` and `workoutPlan.ts` demonstration values.

**Starter prompt:**
```
What health measurements and self-checks do ISS astronauts take routinely, how often, with what devices, and how long does each take? Include exercise countermeasure prescriptions, sleep, medication logging, radiation dosimeter reading, body mass, eye checks and psychological check-ins. Give the source (URL, section, verbatim quote) and tell me what is not public.
```

## 8. Radiation and psychology specifics

**Radiation:** crew dosimeter devices (CAD, TLD/passive, REM), what a crew member can read themselves, units (µGy/h, mGy/day, mSv, dose equivalent), typical ISS dose rates, SPE alert thresholds, NASA limits (career and 30-day/annual/acute), what the crew does on an SPE warning. **Deliver:** `radiation.csv` with `quantity, unit, device, typical_value, alert_threshold, source_url, quote, confidence`. Resolve whether the app key `radiationRate` unit should be µGy/h or something else.

**Psychology:** validated brief tools a layperson can self-administer and that are used or recommended for spaceflight (PHQ, GAD, PANAS, Profile of Mood States, NASA/OCHMO tools, Karolinska Sleepiness Scale, PVT brief reaction time test, WinSCAT), their copyright/licence status, scoring rules, cut-offs, and what to do at each level (self-help, tell the crew, tell the ground). Warning signs of a behavioural emergency. **Deliver:** `psych-tools.json`: `name, items, scoring, thresholds, licence, free_to_use_in_app, source_url, quote, confidence`. Licensing matters: if a tool is not free to embed, say so.

**Starter prompt (radiation):**
```
Describe the radiation monitoring available to ISS and exploration crews (active and passive dosimeters), the units they report, typical in-flight dose rates, NASA dose limits (acute, 30-day, annual, career), and the crew response to a solar particle event warning. Cite each number with URL and verbatim quote.
```
**Starter prompt (psychology):**
```
List brief, validated, self-administered behavioural health and sleepiness/performance tools used or recommended for spaceflight crews or analogs (e.g. NASA OCHMO behavioral health, WinSCAT, PVT, KSS, POMS, PHQ, GAD). For each: items, scoring, thresholds, licence/copyright and whether they can be embedded in an app for free, with source URL and quote.
```

## 9. Product-safety decisions the researcher must inform (bring a recommendation)

1. **Doses.** The app refuses to show doses. In a real autonomous emergency the crew may need the labeled dose from the kit documentation. Research: what do onboard procedures and labels tell crew, who authorizes, and what is the safest design: show the label dose with a required ground confirmation, or never. Give a recommendation with sources.
2. **What the app may say when the ground is unreachable.** What do NASA/ESA procedures instruct?
3. **Thresholds.** Which readings are "act now" vs "watch" for HR, BP, SpO2, temperature, glucose, CO2 symptoms, radiation, pain, with the source and condition (resting, in flight).
4. **Disclaimers and liability wording** used by comparable tools (e.g. NASA CMO guides, telemedicine apps).
5. **Lone crew member, injured crew member, incapacitated crew member:** what the app must support.
6. **Ethical/privacy rules for crew health data** (NASA medical privacy, what is sent to Earth).

**Deliver:** `decisions.md`, one section per item, with options, trade-offs, a recommendation, sources.

## 10. Communications and data

How store-and-forward actually works to and from ISS, Artemis/Gateway and Mars: delay (seconds to ~20 min each way), blackout windows, bandwidth, data format and priority for medical data, private medical conferences, what a "high priority medical packet" would contain. **Deliver:** `comms.csv`: `link, one_way_delay, blackout, bandwidth, medical_data_rules, source_url, quote, confidence`.

---

## Priority order

Hackathon deadline is today, so deliver in this order. After each batch send a message so the developers can wire it in.

1. **Batch 1 (most valuable, ~3 hours):** Section 3 equipment list (names + plain steps for HR, BP, SpO2, temp, glucose), Section 2 inventory top 30 items, Section 5 top 15 conditions list.
2. **Batch 2:** Section 6 protocol cards for the top 3 conditions, Section 4 baselines table, Section 9 decisions 1 and 3.
3. **Batch 3:** remaining sections.

Anything that arrives after the freeze goes into the "Sources" page as future work rather than into the app.

## What the developers will do with each file

| File | Lands in |
| --- | --- |
| `inventory.json` | `src/data/inventory/researcherKit.ts` (replaces the demo subset automatically) |
| `equipment.json`, `new-measurement-keys.csv` | new `src/data/equipment/`, `src/contracts/keys.ts` |
| `protocols/*.json` | `src/modules/protocols/cards/` |
| `baselines-inflight.csv`, `radiation.csv` | `src/data/demoBounds.ts` (becomes cited bounds) |
| `daily-routine.csv`, `baseline-method.md` | `checklistTemplate.ts`, `workoutPlan.ts`, `anomaly.ts` rules |
| `psych-tools.json` | `src/modules/psych` |
| `decisions.md`, `comms.csv` | assistant rules, sync settings, Sources page |
