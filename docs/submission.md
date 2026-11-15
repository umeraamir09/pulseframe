# Pulseframe: Space Apps 2026 submission draft

Paste-ready text for the NASA Space Apps Challenge 2026 form. Fill the two items marked **TODO** before submitting. Challenge: [Create Health Monitoring Software for Astronauts on Space Missions](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=details).

## Project name

Pulseframe

## Tagline (one line)

An onboard crew medical station that works when Earth cannot answer in time.

## High-level summary (about 30 words)

Pulseframe pins an emergency to a 3D skeleton, walks the next test and the treatment options already on board, and scores a week of vitals, fitness, radiation and psychology data against the crew member's own baseline.

## Detailed description

On missions beyond low Earth orbit, communication delay or blackout can stop the ground from helping in time, and the crew medical officer may not be a physician. Pulseframe is a decision-support station for that gap. It is a prototype, not a medical authority, and it uses simulated crew data only.

**Emergency flow.** The crew member describes the problem, taps the affected region on an interactive 3D skeleton, and Pulseframe checks current information against their own recent data. It then walks the tests to run and the immediate steps from cited protocol cards (chest tightness after resistive exercise, headache and CO2, choking, bleeding, burns, eye injury, space motion sickness, and a general fallback), and keeps the case in monitoring afterwards. A test result typed during an emergency is scored against the personal baseline right away.

**Onboard treatment options.** Suggestions come only from a constrained subset of the public NASA ISS medical kit list. The code rejects any item that is not in that inventory. Every item needs an explicit confirm-before-given step. The app never computes or suggests a dose and points to the flight surgeon and the onboard checklist instead.

**Assistant.** A conversational assistant with a 3D astronaut and a voice dock answers questions about the kit, alerts, and protocols from a cited knowledge pack built from our research. The live mode runs on Groq behind a serverless function. If there is no key or no network, it falls back to offline protocol cards, so the app still works with no connection.

**Weekly health record.** A dashboard shows seven simulated mission days grouped by the five NASA HRP hazards, with an AI brief. Automatic detection flags abnormal variables with z-scores against a personal baseline, plus hard bounds for self-report scales. A daily checklist (vitals, exercise, dosimeter, psychology, medication confirmations without doses), a fitness countermeasure tracker, a personal radiation log, and a short psychology check-in feed the same record.

**Safety.** A disclaimer is on every route, the baseline method is labeled as not NASA-validated, and every fixed threshold is marked as a demonstration value. The Sources page lists every resource used and how.

## How we built it

Vite, React, TypeScript, React Router, React Three Fiber and Drei (Three.js), Recharts, Zustand, IndexedDB (idb), and Zod. All crew data lives in the browser. Serverless functions on Vercel call Groq for the live assistant and the dashboard brief. Vitest covers the data layer, the anomaly engine, the protocol matcher, and the assistant validation.

## What we learned / limits

- Safety design mattered more than model output: the inventory filter and the no-dose rule are enforced in code, not left to a prompt.
- Crew data is simulated and the radiation series is not ISS data. Thresholds and the baseline method are demonstration values, not clinical limits.
- The kit is a historical demonstration subset, not a current flight kit.
- Store-and-forward sync to Earth exists in the data layer but its screens were cut to keep the demo path stable.

## NASA data and resources used

1. **Public NASA ISS medical kit checklist.** A transcribed subset is the only inventory the assistant may recommend from. Labeled "Historical demonstration subset, not a current flight kit."
2. **NASA Human Research Program five hazards.** Every module is tagged with its hazard, and the dashboard groups its tiles by hazard.
3. **NASA SRAG Crew Active Dosimeters.** Shapes the radiation log model (dose rate plus cumulative).
4. **NASA exercise countermeasure pages.** Shape the fitness tracker categories (resistive and aerobic) and the checklist.
5. **NASA OCHMO behavioral health technical brief.** Background for the self-report psychology check-in. Pulseframe does not include WinSCAT.
6. **NASA ISS crew health and medication-use sources** (cited per item in the checklist), and the cited research in the `research/` folder of the repo.

## Partner data and references

- Canadian Space Agency radiation article (linked from the radiation page).
- 3D body: Blender Human Base Meshes (CC0), split into regions for the emergency flow.
- Manrope typeface (Open Font License, Google Fonts).
- Libraries: React, Three.js, React Three Fiber, Drei, Recharts, Zustand, idb, Zod.

## Super Intelligence (AI) disclosure

AI tools were used to plan, research, and build this project: Claude (Claude Code) and Cursor agents for planning, code, tests, and research drafting, and Groq (open-weight model through the Groq API) for the live in-app assistant and dashboard brief. In-app suggestions are always filtered to the onboard inventory in code, and all research and safety-critical content was reviewed by the team. No audio is sent to any speech service: the voice dock uses the browser's built-in speech recognition where available.

## Links

- Demo / final project link: **TODO** (the deployed Vercel URL, opened in a private window to confirm it needs no login)
- Repository: https://github.com/umeraamir09/pulseframe (private today. Make it public before submitting if the form asks for source, or use the deployed URL.)
- Video: **TODO** (30 seconds or less)

## 30-second demo video script

Typed input only, captions instead of a voiceover, no faces, no one under 18 on camera or in audio. About 5 seconds per beat.

1. **Dashboard (`/`).** Caption: "A week of simulated vitals against a personal baseline." Show the sleep slump and the heart-rate Act alert with its z-score.
2. **Emergency (`/emergency`).** Caption: "An emergency, pinned to the body." Type "Chest tightness after resistive exercise session" and click the chest on the 3D skeleton.
3. **Current info.** Caption: "Checked against the crew member's own data." Show heart rate against the baseline and the open alert.
4. **Test and differential.** Caption: "Working differential, labeled not definitive." Enter heart rate 96 and show the inline Act alert.
5. **Immediate steps and kit.** Caption: "Only items on board. Confirm before given. No doses." Show the confirm dialog.
6. **Assistant (`/assistant`).** Caption: "Offline-capable assistant with cited answers." Type a question and show the answer with its sources, then end on the Sources page and disclaimer.

## Pre-submit checklist

- [ ] Deployed URL opens in a private window and every route loads directly.
- [ ] `GROQ_API_KEY` set on Vercel, or confirm the offline fallback reads cleanly.
- [ ] Video is 30 seconds or less and plays from the link with no login.
- [ ] Repo is public, or the form only uses the deployed URL.
- [ ] Re-check every link in a private window after the last deploy.
