# condition-vitals.csv: notes and gaps (2026-11-15)

Owner: medical events and protocols researcher. Companion files: `condition-vitals.csv` (42 rows, 15 conditions) and `condition-vitals.provenance.csv` (same row numbers).

## How to read it
- One row per condition and measurement key. Keys come from `keys.ts`, plus `respiratoryRate` from new-measurement-keys.csv.
- `expected_value_or_range_in_condition` is what the source says the reading does in that condition. Most sources give a direction (fast, low), not a number. Rows that give no number say so.
- `alert_threshold` uses NEWS2 score 3 values (quotes in decisions.md section 3), the 2015 ISS ALS breathing rate rule (below 12 or above 30 per minute), or a condition-specific source where one exists (WAO 2020 for anaphylaxis blood pressure, MedlinePlus fever levels). NEWS2 is an Earth hospital scale, not validated in flight.
- `inflight_baseline_ref` points to rows in `baselines-inflight.csv` (and `spaceflight-factors.csv` row 27 for breathing rate).
- `spaceflight_adjustment` only repeats sourced values from those rows: resting systolic about 8 mmHg lower and diastolic about 9 mmHg lower (Norsk 2015), resting core temperature about 1 °C higher (Stahn 2017), heart rate and SpO2 unchanged, breathing rate lower (size not found).
- Every quote was checked by script against the downloaded source text, all are under 25 words, and there are no em dashes. Second quotes in the provenance notes were checked the same way.

## Gaps (NOT FOUND)
- 8 rows are NOT FOUND outright: eye heart rate, headache-CO2 breathing rate and heart rate, anaphylaxis heart rate, urinary heart rate, DCS heart rate and SpO2, respiratory infection breathing rate.
- No source gives a numeric expected value for any carded condition except anaphylaxis (systolic below 90 mmHg or more than 30% below own baseline). Every other row is a direction only.
- No spaceflight-specific alert values for any vital sign. All absolute thresholds are Earth values.
- Oral thermometer offset in flight: NOT FOUND. The +1 °C finding is core temperature, so Earth fever cut-offs (38 °C, 38.3 °C) may fire early in flight. Needs a clinician decision.
- Size of the in-flight drop in breathing rate: NOT FOUND (abstract only).
- No numeric pain alert in any source. Deep burns can hurt little, so pain score must not be used to judge burn severity.
- SpO2 is unreliable after carbon monoxide (2001 ISS checklist). No SpCO device in equipment.json.
- Diastolic BP is not scored by NEWS2; no alert value found.
- Blood loss and dehydration rows rely on MedlinePlus (grade C). No spaceflight source on how shock presents with the lower in-flight resting BP and fluid shift.
- DCS: OCHMO-TB-037 lists no vital sign changes.
- CO2 headache: OCHMO-TB-004 gives CO2 levels and symptoms but no vital sign changes.

## Found while working (for later card updates)
- The 2015 ISS toxic exposure procedure (1.106, PDF p.18 of the 2016 FOIA manual) has an "If comm unavailable" step: do the eye exam or sick call exam, then take history and photos. This is a newer loss-of-signal rule than the 2001 note used on the cards. Not yet added to the cards.
- The 2015 ISS choking procedure (1.105, PDF p.16) asks for pulse, breathing rate and blood pressure after the object clears, and then a private medical conference with the surgeon.
