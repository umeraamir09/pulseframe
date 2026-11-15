# Baseline method for Pulseframe anomaly rules

Accessed 2026-11-15. Facts below carry a source and a short verbatim quote. Lines marked **Recommendation** are our design advice built on those facts. They are not NASA rules.

## What the sources say about adaptation timing

| Key | What changes and when | Source and quote |
| --- | --- | --- |
| all (early days) | Space motion sickness hits most first-time flyers in the first flight days. | Davis 1988, PMID 3240221: "The incidence of SMS during a first Shuttle flight for 85 crewmembers was 67% (57 cases)." |
| heartRate | Shuttle (short flights): heart rate fell in flight. ISS (long flights): 24 h mean unchanged at months 3 to 6. | Fritsch-Yelle 1996, PMID 8964756: "heart rate, diastolic pressure, variability of heart rate and diastolic pressure, and premature ventricular contractions all were significantly reduced in flight." Norsk 2015, PMC4324706: "The mean 24 h heart rate was unchanged by spaceflight" |
| heartRate, BP | Responses differ by person and track the person's preflight values. | Baevsky 2007, PMID 17446414: "the individual responses were different and correlated with preflight values." |
| systolicBP, diastolicBP | 24 h BP runs 8 to 10 mmHg lower at flight day 85 to 192. | Norsk 2015: "Twenty-four hour ambulatory brachial blood pressure is reduced by 8–10 mmHg" |
| temperatureC | Resting core temperature climbs about 1 °C over about 2.5 months, then levels off. | Stahn 2017, PMC5701078: "reaching a plateau after 75 days of spaceflight" |
| body mass (no key yet) | Mass drops in the first 30 days, then holds steady. | Zwart 2014, PMID 25197887: "After an initial loss in the first 30 d of flight, body mass remained constant through the rest of the mission" |
| sleepHours | No trend across ISS missions. About 6 h per night from start to end. | Barger 2014, PMC4188436: "There were no significant trends in sleep variables over the duration of the mission." |
| cognition | NASA uses a preflight baseline for WinSCAT, starting 6 months before launch. | NASA BMed Evidence Report 2016, p. 52: "Baseline testing begins 6 months before launch" |
| vitals (how often) | On ISS, full vitals are recorded at the monthly Periodic Health Status exam. Daily vitals are not standard. | Roden and Ewert, NTRS 20060051792: "Periodic Health Status (PHS) examinations requires crew members to perform these exams on each other monthly." |

NOT FOUND: a spaceflight source that gives a minimum number of days or readings for a personal vital-sign baseline. We checked PubMed, PMC, NTRS and the HRP evidence reports.

## What this means for `src/data/anomaly.ts` (3-day burn-in, 7-day window)

**Recommendation 1: start from a preflight baseline.** NASA does this for WinSCAT, and Baevsky found that in-flight responses track preflight values. Load preflight mean and SD when they exist. Use the in-flight z-score only after burn-in.

**Recommendation 2: a 3-day burn-in is too short for most keys.** Motion sickness in the first days, mass loss over about 30 days, and a temperature rise over about 75 days would all land inside a 3-day baseline. Suggested burn-in per key:
- heartRate, systolicBP, diastolicBP, oxygenSat: 14 days.
- temperatureC: do not freeze a baseline before about day 75. Use a slow rolling window (see below), or the preflight value plus about 1 °C after day 75.
- sleepHours: 7 days is fine (no trend over the mission).
- moodScore, stressScore, teamStrain, sleepQuality, painScore: no flight norm exists for the app's own scales, so 7 days of the person's own data is as good as anything.
During burn-in, use only the cited absolute bounds (the `hard-bound` rule) and do not use z-scores.

**Recommendation 3: a 7-day window is too short for slow drifts and too sparse for monthly vitals.** If crew log vitals daily, use a 14 to 28 day rolling window for HR and BP. Use 28 days or more for temperature, so the slow upward drift does not set off alarms. If vitals are only logged at the monthly PHS, a z-score over a few points means little. Use the absolute bounds alone and compare with the last PHS value.

**Recommendation 4: keep absolute bounds next to z-scores.** A person with a bad baseline would never trigger a z-score alert. In-flight BP runs lower than on Earth (Norsk), so an Earth "high BP" cut-off fires less often in space. Core temperature runs about 1 °C higher (Stahn), so a 38 °C Earth fever cut-off may false-alarm after the first months. Use `baselines-inflight.csv` for both sets of numbers.

**Recommendation 5: data quality.** Use the same device, the same arm, and the same time of day each time. Do not measure temperature right after exercise; Stahn found core temperature rises faster during exercise in space. If a reading looks wrong, repeat it once. The 2001 ISS checklist allows a repeat for BP ("To repeat measurement, refer to steps 5 --- 9"). It gives no rule for how many repeats or whether to average them (NOT FOUND).

## Open questions for the team
1. Does the app expect daily vitals? Public ISS sources show monthly PHS vitals plus emergency use, not daily self-checks.
2. Should temperature use a different baseline model, such as trend-adjusted, because of the slow 75-day rise?
3. Who checks the safety-critical bounds? The brief requires a second person for `safety: true` rows.
