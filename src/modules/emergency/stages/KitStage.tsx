import { useState } from "react";
import type { InventoryItem } from "../../../contracts";
import { GivenDialog } from "../../assistant/GivenDialog";
import { KitSuggestions } from "../../assistant/KitSuggestions";
import type { ProtocolCard } from "../../protocols";
import { errorMessage } from "../caseActions";
import { StageCard } from "../StageCard";

export function KitStage({
  caseId,
  card,
  onContinue,
}: {
  caseId: string;
  card?: ProtocolCard;
  onContinue: () => Promise<void>;
}) {
  const [give, setGive] = useState<InventoryItem | undefined>();
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
    <StageCard kicker="7 Kit" title="From the onboard kit" meta={<span className="em-ok">Confirm before given</span>}>
      <p className="em-note">Pulseframe does not suggest doses.</p>
      <KitSuggestions caseId={caseId} card={card} onGive={setGive} />
      {give ? (
        <GivenDialog item={give} caseId={caseId} onClose={() => setGive(undefined)} onLogged={() => setGive(undefined)} />
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      <button type="button" className="primary em-next" onClick={() => void next()} disabled={busy}>
        {busy ? "Saving…" : "Next: send"}
      </button>
    </StageCard>
  );
}
