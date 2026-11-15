# Contributing to Pulseframe

Two developers, one private repo, one weekend. Keep pull requests small and merge often so you do not block each other.

## Team

| Role | Person | GitHub |
| --- | --- | --- |
| Dev A | Umer | [umeraamir09](https://github.com/umeraamir09) |
| Dev B | Ahmed | [AhmedYasirJwd](https://github.com/AhmedYasirJwd) |

Dev A owns the 3D skeleton, emergency flow, and AI assistant. Dev B owns the data layer, dashboard, anomaly detection, daily checklist, fitness, radiation, psychology, and Earth sync. Both own the shared app shell and the contracts in `src/contracts`.

## Branch workflow

1. Sync `main` before you start: `git checkout main && git pull`.
2. Branch from `main` using the issue number: `git checkout -b feature/pf-5-dashboard`.
3. Keep the branch focused on that issue. Do not mix a dashboard change into an emergency PR.
4. If you must change a shared type in `src/contracts`, do that in its own PR first (or at the top of your PR) and tell the other dev in the issue thread.
5. Open a pull request into `main` using the PR template. Link the issue with `Closes #N`.
6. Ask the other dev for a quick review when you can. If you are blocked on time, self-review against the acceptance criteria and merge, then post a note on the issue.
7. Delete the branch after merge and pull `main` again.

Do not commit directly to `main` after the initial scaffold, except for emergency typo fixes.

## Commit messages

Use a short prefix: `feat:`, `fix:`, `chore:`, `docs:`. Example: `feat: highlight chest region on skeleton click`.

## Rules that apply to every PR

- The app must still run with no assistant API key set. Groq and OpenAI keys are server-only (`GROQ_API_KEY`, `GROQ_MODEL`, `OPENAI_API_KEY`). Never prefix them with `VITE_`. `VITE_ASSISTANT_MODE` may be `offline` (the default) or `live`.
- Never commit API keys or `.env`.
- Medical copy is decision support, not medical authority. Keep the disclaimer visible.
- Umer is 17: no photos, video, or voice of anyone under 18 in the repo, screenshots, or demo assets.
- Credit 3D model licenses on the Sources page when a model is added.
