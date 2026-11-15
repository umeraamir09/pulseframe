import { useState } from "react";
import type { ProtocolCard } from "../../protocols";
import { errorMessage } from "../caseActions";
import { StageCard } from "../StageCard";

export function DifferentialStage({ card, onContinue }: { card: ProtocolCard; onContinue: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function next() {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await onContinue();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <StageCard
      kicker="4 Differential"
      title="Working differential, not a diagnosis"
      meta={<span className="muted small">Unranked. Each card is a working idea.</span>}
    >
      <ul className="em-diff-list">
        {card.differential.map((item) => (
          <li key={item.label} className="em-diff">
            <h3>{item.label}</h3>
            <details>
              <summary>Why?</summary>
              <p>{item.note}</p>
            </details>
          </li>
        ))}
      </ul>
      <p className="em-field-label">Tests on this card</p>
      <div className="em-picks">
        {card.tests.map((test) => (
          <span key={test.title} className="em-chip-lite">
            {test.title}
          </span>
        ))}
      </div>
      <p className="em-act-note">Any Act result: go to steps now.</p>
      <p className="em-caution">{card.cautions}</p>
      <p className="muted small">{card.sourceNote}</p>
      {error ? <p className="error">{error}</p> : null}
      <button type="button" className="primary em-next" onClick={() => void next()} disabled={busy}>
        {busy ? "Saving…" : "Next: tests"}
      </button>
    </StageCard>
  );
}
