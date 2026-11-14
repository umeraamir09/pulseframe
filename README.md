# Pulseframe

An onboard crew medical station for the NASA Space Apps Challenge 2026 challenge [Create Health Monitoring Software for Astronauts on Space Missions](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=details).

**Pitch:** Pulseframe pins an emergency to a 3D skeleton, walks the next test and the treatment options already on board, and keeps a week's vitals, fitness, radiation, and psychology record ready to forward to Earth.

This is a hackathon prototype and a **decision-support** tool. It is not a medical authority, a flight surgeon, or a substitute for NASA medical operations. Use simulated crew data only.

## Docs

- Product spec: [Pulseframe — Space Apps 2026 Product Spec](https://cursor.com/canvas/store-c803f290-9f41-41b1-9e9b-993d1c558d72/0bf5085b-2464-43a3-b740-9e63ab7c34df)
- Feature breakdown and dev split: [Pulseframe: Feature Breakdown & Dev Split](https://cursor.com/canvas/store-c803f290-9f41-41b1-9e9b-993d1c558d72/048a95a2-2fd5-4f5c-b578-a96c7264ea83)
- Research brief (unchanged): [NASA Space Apps 2026: Health Monitoring Software — Team Brief](https://cursor.com/canvas/store-c803f290-9f41-41b1-9e9b-993d1c558d72/a4107434-e067-4280-9064-03f5ccd9ae2c)

## Features

1. Emergency intake with an interactive 3D skeleton, current-info check, test instructions, and immediate steps
2. Onboard treatment suggestions from a constrained formulary, with an AI assistant and an offline fallback
3. Daily checklist, including medications
4. Weekly dashboard with personal baseline alerts
5. Fitness countermeasure tracker
6. Personal radiation log
7. Psychology checkup
8. Store-and-forward sync to Earth or another portal
9. Automatic detection of abnormal variables versus a personal baseline

## Team

| Role | Person | GitHub | Owns |
| --- | --- | --- | --- |
| Dev A | Umer | [@umeraamir09](https://github.com/umeraamir09) | App shell UI, 3D skeleton, emergency flow, AI assistant, Sources page |
| Dev B | Ahmed | [@AhmedYasirJwd](https://github.com/AhmedYasirJwd) | Shared data contracts and persistence, dashboard, anomaly detection, checklist, fitness, radiation, psych, Earth sync |

## Stack

Vite, React, TypeScript, React Router, React Three Fiber / Drei (Three.js), Recharts, Zustand, idb (IndexedDB), Zod.

## Setup

```bash
npm install
npm run dev
```

Other scripts: `npm run build`, `npm run preview`, `npm run lint`.

Copy `.env.example` to `.env` if you are wiring the optional LLM assistant. The app must run with those variables unset (offline protocol cards).

## Folder map

```
src/contracts/     Shared TypeScript types and measurement keys (agree before you diverge)
src/data/          IndexedDB wrapper and simulated seed data (Dev B)
src/modules/shell  Layout, nav, disclaimer (Dev A, shared)
src/modules/emergency
src/modules/skeleton
src/modules/assistant
src/modules/dashboard
src/modules/checklist
src/modules/fitness
src/modules/radiation
src/modules/psych
src/modules/sync
src/modules/sources
```

## Workflow

See [CONTRIBUTING.md](CONTRIBUTING.md). Branch from `main` as `feature/pf-<issue>-short-name`, open a PR, and do not break `src/contracts` without telling the other dev.

## License and credits

Application code is for the team's Space Apps submission. 3D models added later must keep their original licenses (Z-Anatomy and BodyParts3D are CC BY-SA; credit them on the Sources page and in the submission References field).
