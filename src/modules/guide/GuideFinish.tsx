import { useGuide } from "./guideStore";
import { dismissFinish, startScenario } from "./runner";
import { SCENARIOS, SCENARIO_ORDER } from "./scenarios";

/** "11 Your turn": shown on top of the page after the wipe. */
export function GuideFinish() {
  const status = useGuide((s) => s.status);
  const finished = useGuide((s) => s.finished);
  if (status !== "done" || !finished) return null;
  const others = SCENARIO_ORDER.filter((id) => id !== finished);

  return (
    <section className="card guide-finish" aria-labelledby="guide-finish-title">
      <p className="guide-overline">DEMO FINISHED</p>
      <h2 id="guide-finish-title">Practice is over. The station is yours.</h2>
      <p className="muted">I wiped every demo record. Nothing from the {SCENARIOS[finished].title.toLowerCase()} demo is saved.</p>
      <div className="row wrap guide-finish-actions">
        <button type="button" className="btn primary" onClick={dismissFinish}>
          Start using Pulseframe
        </button>
        <button type="button" className="btn secondary" onClick={() => startScenario(finished)}>
          Replay this demo
        </button>
      </div>
      <hr />
      <h3 className="h3">Play another scenario</h3>
      <div className="guide-finish-grid">
        {others.map((id) => (
          <div key={id} className="tile">
            <p className="t">{SCENARIOS[id].title}</p>
            <p className="muted small">{SCENARIOS[id].blurb}</p>
            <button type="button" className="link-btn" onClick={() => startScenario(id)}>
              Play this scenario
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
