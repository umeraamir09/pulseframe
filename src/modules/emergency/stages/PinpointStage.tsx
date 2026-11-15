import { useState, type FormEvent } from "react";
import { UNITS, type SkeletonRegionId } from "../../../contracts";
import { REGION_LABELS } from "../../skeleton/regions";
import { errorMessage } from "../caseActions";
import { StageCard } from "../StageCard";

export function PinpointStage({
  narrative,
  selected,
  onBack,
  onSavePain,
  onContinue,
}: {
  narrative: string;
  selected: readonly SkeletonRegionId[];
  onBack: () => Promise<void>;
  onSavePain: (value: number) => Promise<void>;
  onContinue: () => Promise<void>;
}) {
  const [pain, setPain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const ready = selected.length > 0 && !busy;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(undefined);
    try {
      if (pain.trim()) {
        const value = Number(pain);
        if (!Number.isFinite(value) || value < 0 || value > 10) {
          setError("Enter a pain score from 0 to 10, or leave it blank.");
          setBusy(false);
          return;
        }
        await onSavePain(value);
      }
      await onContinue();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <StageCard kicker="2 Pinpoint" title="Where is it?">
      <p className="em-quote">{narrative}</p>
      <p>Select every region that hurts. Click the body, or use the region buttons under it. You can select more than one.</p>
      <div className="em-picks" aria-label="Selected regions">
        {selected.length === 0 ? (
          <span className="muted">Nothing selected yet.</span>
        ) : (
          selected.map((id) => (
            <span key={id} className="em-region-pill">
              {REGION_LABELS[id]}
            </span>
          ))
        )}
      </div>
      <form onSubmit={(event) => void submit(event)}>
        <label className="em-pain" htmlFor="em-pain">
          Pain, 0 to 10
          <span className="em-pain-row">
            <input
              id="em-pain"
              type="number"
              inputMode="decimal"
              min={0}
              max={10}
              step={1}
              value={pain}
              placeholder="0–10"
              onChange={(event) => setPain(event.target.value)}
            />
            <span className="muted">{UNITS.painScore}</span>
          </span>
          <span className="muted small">Optional. Saved with this case if you enter it.</span>
        </label>
        {error ? <p className="error">{error}</p> : null}
        <div className="em-actions">
          <button type="button" onClick={() => void onBack()} disabled={busy}>
            Back
          </button>
          <button type="submit" className="primary" disabled={!ready}>
            {busy ? "Saving…" : "Next: check"}
          </button>
        </div>
      </form>
    </StageCard>
  );
}
