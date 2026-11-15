import { FIRST_SEED_DAY, MISSION_DAY_TODAY, SIM_CREW, missionDayLabel, missionDayStart, store, useLive } from "../../data/db";
import { usePageMeta } from "../../ui/pageMeta";
import { CheckInForm } from "./CheckInForm";

const OCHMO_BRIEF = "https://www.nasa.gov/wp-content/uploads/2023/03/behavioral-health-technical-brief-ochmo.pdf";

export function PsychPage() {
  usePageMeta("Psych check-in", `${missionDayLabel(MISSION_DAY_TODAY)} · self-report, about 1 minute`);
  const { data: checks } = useLive(() => store.listPsych(SIM_CREW.id, missionDayStart(FIRST_SEED_DAY).toISOString()), []);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <CheckInForm checks={checks ?? []} />
      <p className="muted small">
        Isolation and confinement are one of NASA's five hazards of human spaceflight. NASA's{" "}
        <a href={OCHMO_BRIEF} target="_blank" rel="noreferrer">
          behavioral health brief
        </a>{" "}
        mentions WinSCAT, which Pulseframe does not include.
      </p>
    </div>
  );
}
