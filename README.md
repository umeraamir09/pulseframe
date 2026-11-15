# Pulseframe

An onboard crew medical station for the NASA Space Apps Challenge 2026 challenge [Create Health Monitoring Software for Astronauts on Space Missions](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=details).

**Pitch:** On a mission where Earth cannot answer in time, Pulseframe pins an emergency to a 3D skeleton, walks the next test and the treatment options already on board, and keeps a week of vitals, fitness, radiation, and psychology data scored against the crew member's own baseline.

This is a hackathon prototype and a **decision-support** tool. It is not a medical authority, a flight surgeon, or a substitute for NASA medical operations. It uses simulated crew data only, and it never computes or suggests a dose.

## Features

1. **Emergency flow:** intake, an interactive 3D skeleton to pinpoint the problem, a current-info check against the crew member's own data, test instructions, immediate steps from cited protocol cards, and monitoring afterwards.
2. **Onboard treatment options:** suggestions come only from a constrained subset of the public NASA ISS medical kit list. Code rejects any item that is not in that inventory, and every item needs a confirm-before-given step.
3. **Assistant:** a conversational assistant with the 3D astronaut and a voice dock. It answers from a cited knowledge pack built from `research/`. The live mode uses Groq through a serverless function, and it falls back to offline protocol cards if there is no key or no network.
4. **Weekly dashboard:** seven simulated mission days, grouped by NASA HRP hazard, with an AI brief.
5. **Automatic abnormal-variable detection:** z-scores against a personal baseline, plus hard bounds for self-report scales, shown as Alerts.
6. **Daily checklist:** vitals, exercise, dosimeter, psychology, and medication confirmations (no doses).
7. **Fitness countermeasure tracker:** resistive and aerobic sessions.
8. **Personal radiation log:** dose rate and cumulative dose from a simulated crew dosimeter.
9. **Psychology check-in:** a short self-report, not WinSCAT.
10. **Sources page:** every NASA and partner resource, how each is used, and the full disclaimer.

The store-and-forward queue (`src/data/sync.ts`) is still in the data layer, but its screens were removed from the UI.

## Data and sources

- Crew data is simulated (MD 136 to MD 142). It is not ISS data and not a reference range.
- The medical kit is a historical demonstration subset of the public NASA ISS medical kit list, not a current flight kit.
- Protocol cards and the knowledge pack are compiled from the cited research in [`research/`](research/). Each row carries provenance.
- The 3D body is built from Blender Human Base Meshes (CC0). Any added model must keep its original license and be credited on the Sources page and in the submission References field.

## Stack

Vite, React, TypeScript, React Router, React Three Fiber / Drei (Three.js), Recharts, Zustand, idb (IndexedDB), Zod. Optional Vercel serverless functions in `api/` (`assistant.ts`, `brief.ts`) call Groq. Tests run with Vitest.

## Setup

```bash
npm install
npm run dev
```

Other scripts: `npm run build` (builds the knowledge pack first), `npm run preview`, `npm run lint`, `npm test`.

The app runs with no environment variables set, using offline protocol cards. To enable the live assistant and brief, copy `.env.example` to `.env` and set `VITE_ASSISTANT_MODE=live`. Set `GROQ_API_KEY` (and optionally `GROQ_MODEL`) as a **server-side** variable in Vercel. Never prefix keys with `VITE_`, because Vite inlines those into the public bundle. `OPENAI_API_KEY` is reserved for optional dictation.

## Folder map

```
api/               Serverless functions: assistant and brief (Groq)
research/          Cited research, protocols, and data CSVs with provenance
scripts/           Knowledge-pack build
src/contracts/     Shared TypeScript types and measurement keys
src/data/          IndexedDB store, simulated seed, anomaly engine, kit inventory
src/ui/            Shared primitives (disclaimer, chips, alert cards, icons)
src/modules/       shell, dashboard, alerts, emergency, protocols, assistant,
                   checklist, fitness, radiation, psych, sources
public/models/     3D body and astronaut GLB files
```

## Workflow

See [CONTRIBUTING.md](CONTRIBUTING.md). Branch from `main` as `feature/pf-<issue>-short-name`, open a PR, and do not break `src/contracts` without telling the other dev.

## License and credits

Application code is for the team's Space Apps submission. See the Sources page in the app for all NASA, CSA, and model credits.
