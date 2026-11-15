import { Fragment, useState } from "react";
import { KEY_LABELS, UNITS, type EmergencyStage } from "../../contracts";
import { MISSION_DAY_TODAY, SIM_CREW, missionDayLabel, store, useLive } from "../../data/db";
import { fmtValue } from "../../ui/alertFormat";
import { Icon } from "../../ui/Icon";
import { usePageMeta } from "../../ui/pageMeta";
import { HandoffPanel, KitPanel, MonitorBanner, StepsPanel } from "./ActionPanels";
import { CurrentInfoPanel, IntakePanel, PinpointPanel } from "./IntakePanels";
import { DifferentialPanel, TestsPanel } from "./ProtocolPanels";
import { STAGES, scoreAgainst, stageIndex, useEmergencyCase } from "./useEmergencyCase";

type Group = "a" | "b" | "c";

function groupOf(stage: EmergencyStage): Group {
  const i = stageIndex(stage);
  if (i <= stageIndex("current-info")) return "a";
  if (i <= stageIndex("tests")) return "b";
  return "c";
}

function StageStrip({ current, onPick }: { current: number; onPick: (stage: EmergencyStage) => void }) {
  return (
    <nav className="stage-strip" aria-label="Emergency stages">
      {STAGES.map((s, i) => {
        const state = i < current ? "done" : i === current ? "current" : "upcoming";
        return (
          <Fragment key={s.id}>
            {i > 0 ? <span className={`stage-sep${i <= current ? " done" : ""}`} aria-hidden="true" /> : null}
            <button
              type="button"
              className={`stage-step ${state}`}
              style={{ border: 0, background: state === "current" ? undefined : "transparent" }}
              disabled={i > current}
              aria-current={state === "current" ? "step" : undefined}
              onClick={() => onPick(s.id)}
            >
              <span className="n">{state === "done" ? <Icon name="check" size={16} strokeWidth={2.4} /> : i + 1}</span>
              {s.label}
            </button>
          </Fragment>
        );
      })}
    </nav>
  );
}

export function EmergencyPage() {
  const api = useEmergencyCase();
  const { c, loading } = api;
  const [view, setView] = useState<Group | null>(null);
  const { data: alerts } = useLive(() => store.listAlerts(SIM_CREW.id), []);
  const openAlerts = (alerts ?? []).filter((a) => !a.ackedAt);
  const { data: baselines } = useLive(() => store.getBaselines(SIM_CREW.id), []);
  const stored = c ? (alerts ?? []).filter((a) => a.caseId === c.id) : [];
  // Test results the store did not raise a new alert for still count, scored against the personal baseline.
  const caseAlerts = [
    ...stored,
    ...api.steps
      .filter((s) => s.kind === "test" && !stored.some((a) => a.measurementId && a.measurementId === s.measurementId))
      .map((s) => scoreAgainst(s, baselines ?? []))
      .filter((a): a is NonNullable<typeof a> => Boolean(a)),
  ];
  const stage: EmergencyStage = c?.stage ?? "intake";
  const current = stageIndex(stage);
  const group = view && c && ["a", "b", "c"].indexOf(view) <= ["a", "b", "c"].indexOf(groupOf(stage)) ? view : groupOf(stage);

  const worst = [...caseAlerts].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "act" ? -1 : 1))[0];
  const tail = !c
    ? "Describe, pinpoint, check current info"
    : groupOf(stage) === "c" && worst
      ? `${worst.severity === "act" ? "Act" : "Watch"}: ${KEY_LABELS[worst.key].toLowerCase()} ${fmtValue(worst.value)} ${UNITS[worst.key]}${
          worst.zScore !== undefined ? `, z ${worst.zScore.toFixed(2)}` : ""
        }`
      : group === "a"
        ? "Describe, pinpoint, check current info"
        : c.narrative;
  usePageMeta("Emergency", `${c ? `Case ${api.caseNumber ?? ""}` : "New case"} · ${missionDayLabel(MISSION_DAY_TODAY)} · ${tail}`);

  if (loading) return <p className="muted">Loading the case…</p>;

  return (
    <div>
      <StageStrip
        current={current}
        onPick={(s) => {
          const g = groupOf(s);
          setView(g === groupOf(stage) ? null : g);
        }}
      />

      {group === "a" ? (
        <div className="em-grid a">
          <div className="em-col">
            <IntakePanel key={`${c?.id ?? "new"}-${api.intake ? "i" : "-"}`} api={api} />
          </div>
          <PinpointPanel api={api} openAlerts={openAlerts} />
          <div className="em-col">
            <CurrentInfoPanel api={api} openAlerts={openAlerts} />
          </div>
        </div>
      ) : null}

      {group === "b" ? (
        <div className="em-grid b">
          <div className="em-col">
            <DifferentialPanel api={api} openAlerts={openAlerts} />
          </div>
          <div className="em-col">
            <TestsPanel api={api} alerts={alerts ?? []} />
          </div>
        </div>
      ) : null}

      {group === "c" ? (
        <>
          <div className="em-grid c">
            <div className="em-col">
              <StepsPanel api={api} />
            </div>
            <div className="em-col">
              <KitPanel api={api} />
              <HandoffPanel api={api} caseAlerts={caseAlerts} />
            </div>
          </div>
          {stage === "monitoring" ? <MonitorBanner api={api} /> : null}
        </>
      ) : null}

      {view && view !== groupOf(stage) ? (
        <button type="button" className="btn primary" style={{ marginTop: 16 }} onClick={() => setView(null)}>
          <Icon name="arrowR" size={18} /> Back to the current stage
        </button>
      ) : null}
    </div>
  );
}
