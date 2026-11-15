import { useState } from "react";
import { KEY_LABELS, UNITS, type Alert, type EmergencyStage, type SkeletonRegionId } from "../../contracts";
import { MISSION_DAY_TODAY, SIM_CREW, missionDayLabel, store, useLive } from "../../data/db";
import { Disclaimer } from "../../ui/Disclaimer";
import { HazardChip } from "../../ui/HazardChip";
import { getProtocol, matchProtocol } from "../protocols";
import { SkeletonView } from "../skeleton/SkeletonView";
import { toggleRegion } from "../skeleton/regions";
import { errorMessage } from "./caseActions";
import { regionsWithOpenAlerts } from "./flags";
import { FLOW, nextStage, stageIndex, visibleStage } from "./flow";
import { MonitorBanner } from "./MonitorBanner";
import { CurrentInfoStage } from "./stages/CurrentInfoStage";
import { DifferentialStage } from "./stages/DifferentialStage";
import { HandoffStage } from "./stages/HandoffStage";
import { ImmediateStage } from "./stages/ImmediateStage";
import { IntakeStage } from "./stages/IntakeStage";
import { KitStage } from "./stages/KitStage";
import { PinpointStage } from "./stages/PinpointStage";
import { TestsStage } from "./stages/TestsStage";
import { useEmergencyCase } from "./useEmergencyCase";

function Progress({ stage }: { stage: EmergencyStage }) {
  const index = stageIndex(stage);
  const current = FLOW[Math.min(index, FLOW.length - 1)]!;
  const stepNo = Math.min(index + 1, FLOW.length);
  return (
    <>
      <p className="em-progress-compact">
        Step {stepNo} of {FLOW.length}
        {stage === "monitoring" ? " · Monitoring" : ` · ${current.label}`}
      </p>
      <ol className="em-progress" aria-label="Emergency stages">
        {FLOW.map((step, i) => {
          const state = i < index ? "is-done" : i === index ? "is-now" : "is-todo";
          return (
            <li key={step.stage} className={state} aria-current={state === "is-now" ? "step" : undefined}>
              <span className="em-dot" aria-hidden="true">
                {state === "is-done" ? "✓" : i + 1}
              </span>
              <span>{step.label}</span>
              {i < FLOW.length - 1 ? <span className="em-dash" aria-hidden="true" /> : null}
            </li>
          );
        })}
      </ol>
    </>
  );
}

function subtitle(stage: EmergencyStage, narrative: string | undefined, alerts: Alert[], caseId: string | undefined): string {
  const day = missionDayLabel(MISSION_DAY_TODAY);
  const act = alerts
    .filter((alert) => alert.caseId === caseId && !alert.ackedAt && alert.severity === "act" && alert.zScore !== undefined)
    .sort((a, b) => Date.parse(b.openedAt) - Date.parse(a.openedAt))[0];
  if (act && stage !== "intake" && stage !== "pinpoint" && stage !== "current-info") {
    return `Case · ${day} · Act: ${KEY_LABELS[act.key].toLowerCase()} ${act.value} ${UNITS[act.key]}, z ${act.zScore?.toFixed(2)}`;
  }
  if (narrative) return `Case · ${day} · ${narrative}`;
  return `Case · ${day} · Describe, pinpoint, check current info`;
}

export function EmergencyPage() {
  const flow = useEmergencyCase();
  const alerts = useLive(() => store.listAlerts(SIM_CREW.id), []);
  const [pendingRegions, setPendingRegions] = useState<SkeletonRegionId[] | null>(null);
  const [error, setError] = useState<string>();

  if (flow.loading) {
    return (
      <section className="emergency">
        <header className="em-head">
          <HazardChip id="environment" />
          <h1>Emergency</h1>
        </header>
        <p className="muted">Loading the case…</p>
        <Disclaimer variant="emergency" />
      </section>
    );
  }

  const stage = visibleStage(flow.open);
  const savedRegions = flow.open?.regionIds ?? [];
  const selected = pendingRegions && pendingRegions.join() !== savedRegions.join() ? pendingRegions : savedRegions;
  const flagged = regionsWithOpenAlerts(alerts.data ?? []);
  const showSkeleton = stage !== "intake" && stage !== "monitoring";
  const card = flow.open?.protocolId
    ? (getProtocol(flow.open.protocolId) ?? matchProtocol(flow.open.narrative, flow.open.regionIds))
    : undefined;

  async function run(action: () => Promise<unknown>) {
    setError(undefined);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function onToggle(id: SkeletonRegionId) {
    if (stage !== "pinpoint") return;
    const next = toggleRegion(selected, id);
    setPendingRegions(next);
    void flow.setRegions(next).catch((err: unknown) => {
      setPendingRegions(null);
      setError(errorMessage(err));
    });
  }

  const tests = flow.steps.filter((step) => step.kind === "test");
  const actions = flow.steps.filter((step) => step.kind === "action");
  const ahead = nextStage(stage);

  function goNext() {
    return run(async () => {
      if (ahead) await flow.advance(ahead);
    });
  }

  return (
    <section className="emergency">
      <header className="em-head">
        <div>
          <HazardChip id="environment" />
          <h1>Emergency</h1>
          <p>{subtitle(stage, flow.open?.narrative, alerts.data ?? [], flow.open?.id)}</p>
        </div>
      </header>
      <p className="sr" aria-live="polite">
        {stage === "monitoring" ? "Monitoring" : `Stage ${Math.min(stageIndex(stage) + 1, FLOW.length)} of ${FLOW.length}`}
      </p>
      <Progress stage={stage} />
      <Disclaimer variant="emergency" />
      {flow.error ? <p className="error">{errorMessage(flow.error)}</p> : null}

      <div className={showSkeleton ? "split emergency-split" : "emergency-single"}>
        <div className="em-stage">
          {stage === "intake" ? <IntakeStage initial={flow.open?.narrative ?? ""} onStart={(narrative) => run(() => flow.startCase(narrative))} /> : null}
          {stage === "pinpoint" && flow.open ? (
            <PinpointStage
              narrative={flow.open.narrative}
              selected={selected}
              onBack={() => run(() => flow.retreat())}
              onSavePain={async (value) => {
                await flow.recordCaseMeasurement(flow.open!.id, "painScore", value);
              }}
              onContinue={() => run(() => flow.advance("current-info"))}
            />
          ) : null}
          {stage === "current-info" ? (
            <CurrentInfoStage
              onBack={() => run(() => flow.retreat())}
              onContinue={(snapshot) => run(() => flow.advance("differential", { currentInfoSnapshot: snapshot }))}
            />
          ) : null}
          {stage === "differential" && card ? (
            <DifferentialStage card={card} onContinue={goNext} />
          ) : null}
          {stage === "differential" && !card ? <p className="muted">Preparing the working differential…</p> : null}
          {stage === "tests" ? (
            tests.length === 0 ? (
              <p className="muted">Preparing the protocol steps…</p>
            ) : (
              <TestsStage
                steps={tests}
                onSave={async (step, value) => {
                  if (!flow.open || !step.inputKey) return undefined;
                  const result = await flow.recordCaseMeasurement(flow.open.id, step.inputKey, value);
                  await flow.completeStep(step.id, { resultValue: value, measurementId: result.measurement.id });
                  return result.alert;
                }}
                onDone={(stepId) => flow.completeStep(stepId)}
                onContinue={goNext}
                onGotoSteps={() => run(() => flow.advance("immediate"))}
              />
            )
          ) : null}
          {stage === "immediate" ? (
            actions.length === 0 ? (
              <p className="muted">Preparing the protocol steps…</p>
            ) : (
              <ImmediateStage
                steps={actions}
                onToggle={(stepId) => flow.completeStep(stepId)}
                onSkip={(reason) => flow.skipRemainingActions(reason)}
                onContinue={goNext}
              />
            )
          ) : null}
          {stage === "kit" && flow.open ? (
            <KitStage caseId={flow.open.id} card={card} onContinue={goNext} />
          ) : null}
          {stage === "handoff" && flow.open ? (
            <HandoffStage
              caseId={flow.open.id}
              narrative={flow.open.narrative}
              regions={flow.open.regionIds}
              steps={flow.steps}
              hasSnapshot={Boolean(flow.open.currentInfoSnapshot)}
              onSend={() => run(() => flow.handoffCase(flow.open!.id))}
            />
          ) : null}
          {stage === "monitoring" && flow.open ? (
            <MonitorBanner
              caseId={flow.open.id}
              packetId={flow.open.packetId}
              onClose={() => run(() => flow.closeCase())}
            />
          ) : null}
        </div>
        {showSkeleton ? (
          <SkeletonView
            selected={selected}
            flagged={flagged}
            readOnly={stage !== "pinpoint"}
            onToggle={stage === "pinpoint" ? onToggle : undefined}
          />
        ) : null}
      </div>

      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
