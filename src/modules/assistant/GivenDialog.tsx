import { useEffect, useId, useRef, useState } from "react";
import type { InventoryItem, MedicationAdmin } from "../../contracts";
import { SIM_CREW, store } from "../../data/db";
import { CONFIRMED_BY_DEFAULT, DOSE_PROMPT, SURGEON_CHECK, canLogGiven } from "./copy";

const PRESETS = [CONFIRMED_BY_DEFAULT, "Crewmate B"];

/** Confirm-before-given. The dose field starts empty. Pulseframe never fills it in. */
export function GivenDialog({
  item,
  caseId,
  onClose,
  onLogged,
}: {
  item: InventoryItem;
  caseId?: string;
  onClose: () => void;
  onLogged: (row: MedicationAdmin) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const doseRef = useRef<HTMLInputElement>(null);
  const doseId = useId();
  const byId = useId();
  const checkId = useId();
  const [doseText, setDoseText] = useState("");
  const [confirmedBy, setConfirmedBy] = useState(CONFIRMED_BY_DEFAULT);
  const [surgeonApproved, setSurgeonApproved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const ready = canLogGiven({ doseText, confirmedBy, surgeonApproved }) && !saving;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    doseRef.current?.focus();
  }, []);

  async function logGiven() {
    if (!canLogGiven({ doseText, confirmedBy, surgeonApproved }) || saving) return;
    setSaving(true);
    setError(undefined);
    try {
      const row = await store.recordMedicationAdmin({
        crewId: SIM_CREW.id,
        itemId: item.id,
        ...(caseId ? { caseId } : {}),
        doseText: doseText.trim(),
        givenAt: new Date().toISOString(),
        confirmedBy: confirmedBy.trim(),
      });
      ref.current?.close();
      onLogged(row);
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Could not record that.");
    }
  }

  return (
    <dialog
      ref={ref}
      className="given-dialog"
      aria-labelledby="given-title"
      onCancel={(event) => {
        event.preventDefault();
        ref.current?.close();
        onClose();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void logGiven();
        }}
      >
        <header className="given-head">
          <span className="given-shield" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24">
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                d="M12 3 5 6v6c0 4.2 2.8 7.4 7 8.5 4.2-1.1 7-4.3 7-8.5V6l-7-3z"
              />
            </svg>
          </span>
          <div>
            <h2 id="given-title">Confirm before given</h2>
            <p>Crew enters everything. Pulseframe only records it.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <section className="given-item">
          <h3>{item.name}</h3>
          <p className="muted">{item.pack}</p>
          <dl>
            <div>
              <dt>Strength</dt>
              <dd>{item.strength}</dd>
            </div>
            <div>
              <dt>Route</dt>
              <dd>{item.route}</dd>
            </div>
            <div>
              <dt>Comments</dt>
              <dd>{item.comments || "Not stated in the checklist"}</dd>
            </div>
          </dl>
        </section>

        <label className="dose-field" htmlFor={doseId}>
          <span>Dose, typed by crew exactly as instructed</span>
          <span className="field-help">{DOSE_PROMPT}</span>
          <input
            ref={doseRef}
            id={doseId}
            name="doseText"
            value={doseText}
            autoComplete="off"
            placeholder="Type what the flight surgeon told you"
            required
            onChange={(event) => setDoseText(event.target.value)}
          />
        </label>

        <fieldset className="confirm-by">
          <legend>Confirmed by</legend>
          <div className="preset-row">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={confirmedBy === preset ? "preset on" : "preset"}
                onClick={() => setConfirmedBy(preset)}
              >
                {preset}
              </button>
            ))}
          </div>
          <label htmlFor={byId}>
            <span className="sr">Name of the person confirming</span>
            <input
              id={byId}
              name="confirmedBy"
              value={confirmedBy}
              autoComplete="off"
              onChange={(event) => setConfirmedBy(event.target.value)}
              required
            />
          </label>
        </fieldset>

        <label className={surgeonApproved ? "surgeon-check on" : "surgeon-check"} htmlFor={checkId}>
          <input
            id={checkId}
            type="checkbox"
            checked={surgeonApproved}
            required
            onChange={(event) => setSurgeonApproved(event.target.checked)}
          />
          <span>{SURGEON_CHECK}</span>
        </label>

        <p className="dose-warn">Pulseframe does not suggest doses.</p>
        <p className="dialog-disclaimer" role="note">
          Decision support only. This is not a diagnosis. Contact the flight surgeon.
        </p>
        {error ? <p className="error">{error}</p> : null}

        <div className="row-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={!ready}>
            Log as given
          </button>
        </div>
      </form>
    </dialog>
  );
}
