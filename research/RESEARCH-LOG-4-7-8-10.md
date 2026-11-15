# Research log: sections 4, 7, 8 and 10, 2026-11-15

Owner: physiology, radiation, routine, psych and comms researcher. Merge into the shared RESEARCH-LOG.md if one exists.
All dates accessed: 2026-11-15. All quotes were checked by script against cached source text (/workspace/pf-cache) and are under 25 words.

## Files
| File | Rows | Notes |
|---|---|---|
| baselines-inflight.csv | 30 | All 13 keys in keys.ts covered (some as NOT FOUND) |
| spaceflight-factors.csv | 26 | hazardId uses the 5 HRP ids |
| radiation.csv | 20 | radiationRate unit decision below |
| daily-routine.csv | 20 | kind and linkedKey match types.ts |
| baseline-method.md | 1 page | burn-in, window, adaptation |
| psych-tools.json | 9 tools | plus action_levels, behavioral_emergency, not_found |
| comms.csv | 17 | ISS, Artemis/Orion, Gateway, Mars |
| *.provenance.csv | same rows | title, page, date, environment, safety, notes per row |

Extra fields the brief asks for (document title, page, date, environment tag, safety flag) are not in the brief's column lists. To keep headers exact, they live in a sidecar `<file>.provenance.csv` keyed by csv_row (row 2 = first data row). psych-tools.json carries them inline.

## Main searches and sources
- PubMed E-utilities for abstracts: Norsk 2015, Hughson 2012/2016, Baevsky 2007, Stahn 2017, Barger 2014, Conkin 2017, Kerstman 2012, Lee 2015/2020, Davis 1988, Iwase, Lang 2004, Gopalakrishnan 2010, Rooney 2019, Law 2014, Kast 2017, Kroenke 2001/2003, Spitzer 2006, Akerstedt 1990, Basner 2011/2015, Watson 1988, PC-PVT 2018.
- NASA NTRS: BMed evidence report 2016, CAD presentation, Roden PHS abstract, Dulin poster, Reaction Self Test, ISS Ku-band, Gateway comms paper, Johnson draft Artemis flight rules (spaceweather.gov).
- NASA web: OCHMO tech briefs (radiation TB-020, CO2 TB-004), SRAG, HRP hazard pages, exercise, Space Network, data rate upgrade, Artemis II day 6 blog, O2O laser, Mars Relay Network, JPL conjunction.
- Others: MedlinePlus (ground normals), DOSIS (J Space Weather Space Clim 2017), ISS Medical Checklist 2001 (mirror), PHQ screeners site and manual, KSS book chapter (UPenn copy), Pearson POMS 2 page, NIMH warning-sign pages, IPNSIG talk transcript.

## Blocked or failed
- AHA and CDC pages block curl; used MedlinePlus instead (confidence C for ground normals).
- swsc-journal blocks curl; read via fetch tool and cached.
- FASEB abstract, ePROVIDE PANAS page: not fetched, not used.
- Hughson 2016 full text paywalled (glucose mean not available).
- nasa.gov ISS Medical Checklist URL returns 404; used a third-party mirror (flagged in notes).

## NOT FOUND (main gaps)
- In-flight mean blood glucose (only insulin resistance trend).
- ISS long-duration SpO2 mean (Shuttle value only).
- Norms for app scales moodScore, stressScore, teamStrain, sleepQuality (they are app-defined).
- ISS-RAD and CAD numeric alarm levels.
- Minimum number of baseline days in any NASA source.
- Resistive vs aerobic split of daily exercise; body mass frequency; daily mood check requirement.
- NASA OCHMO behavioural self-report tool list and cut-offs; licences for NASA Cognition battery and Reaction Self Test software; PVT-B lapse threshold (full paper only).
- Spaceflight-validated cut-offs for PHQ/GAD/KSS.
- Exact ISS one-way delay figure (NASA says milliseconds, no noticeable delay); ISS gap length per orbit.
- Primary NASA source for 1.3 s Moon delay (used talk transcript, B; physics check 1.28 s).
- Crewed Mars bandwidth; crewed conjunction plan; any NASA rule on medical data priority or encryption on downlink.

## Decisions and recommendations
- radiationRate: keys.ts says µGy/h; types.ts has rateUgyPerHour and cumulativeMgy. The crew CAD shows mGy and µGy/d with 20 µGy steps. Recommendation: show the crew µGy/day (matches CAD); store either µGy/day or µGy/h with /24 conversion. Typical ISS: about 160 µGy/d badge (6.7 µGy/h); 250-286 µGy/d Columbus total (10.4-11.9 µGy/h); single days to 370 µGy/d. Act level: Artemis draft HERA shelter at 75 µGy/min (4500 µGy/h). Do not convert µGy to mSv in-app.
- Baseline: seed from preflight; 14-day burn-in for HR/BP/SpO2; temperature needs a trend model to about day 75; 7 days for sleep and subjective scales; keep absolute bounds alongside z-scores.
- Psych: embed PHQ-2, PHQ-9, GAD-7 (free). Do not embed KSS, PANAS, POMS 2, WinSCAT, Cognition without permission. Write own PVT from the published method or use PC-PVT terms.
- Emergency packet: base on ISS PMC pre-call list (symptoms, intensity, duration, meds, performance, last meal, vitals) plus baseline deltas and actions taken.
- ISS checklist behavioural emergency pages contain drug doses; keep doses out of the app.

## Open questions
- Are vitals daily in Pulseframe, or follow ISS (monthly PHS plus as needed)?
- Who signs off the action-level cut-offs (clinician)?
- Should radiationRate unit change in keys.ts (team lead decision; I did not edit /workspace/pulseframe)?
- Do we need new keys: bodyMass, respiratoryRate, cognitive score, visual acuity? (see also new-measurement-keys.csv from batch 1).
