import { useEffect, useId, useRef, useState } from "react";
import type { InventoryItem, MedicationAdmin } from "../../contracts";
import { SIM_CREW, store } from "../../data/db";
import { DISCLAIMER_COPY } from "../../ui/disclaimerCopy";
import { Icon } from "../../ui/Icon";
import { CONFIRMED_BY_DEFAULT, DOSE_PROMPT, PROVENANCE_LABEL, SURGEON_CHECK, canLogGiven } from "./copy";

const PEOPLE = [
  { value: CONFIRMED_BY_DEFAULT, label: "Crew A", initials: "CA" },
  { value: "Crewmate B", label: "Crewmate B" },
];

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

  function close() {
    ref.current?.close();
    onClose();
  }

  return (
    <dialog
      ref={ref}
      className="given-dialog"
      aria-labelledby="given-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void logGiven();
        }}
      >
        <header className="given-head">
          <span className="icon-badge lg watch sq">
            <Icon name="shield" size={22} />
          </span>
          <div className="grow">
            <h2 id="given-title" className="h2">
              Confirm before given
            </h2>
            <p>Crew enters everything. Pulseframe only records it.</p>
          </div>
          <button type="button" className="icon-round" style={{ background: "var(--surface2)" }} onClick={close} aria-label="Close">
            <Icon name="x" size={20} />
          </button>
        </header>

        <div className="item-row">
          <span className="icon-badge white" style={{ color: "var(--accent)" }}>
            <Icon name="pill" size={18} />
          </span>
          <div className="grow">
            <div className="t">{item.name}</div>
            <div className="d row" style={{ gap: 4 }}>
              <Icon name="kit" size={12} /> {PROVENANCE_LABEL}
            </div>
          </div>
        </div>

        <div className="attr-chips">
          <span>
            Strength <b>{item.strength}</b>
          </span>
          <span>
            Route <b>{item.route}</b>
          </span>
          <span title={item.comments}>
            Comments <b>{item.comments ? "From source PDF" : "Not stated"}</b>
          </span>
        </div>

        <div className="field">
          <label className="field-label" htmlFor={doseId}>
            Dose, typed by crew exactly as instructed
          </label>
          <span className="faint small">{DOSE_PROMPT}</span>
          <div className="unit-input dose-input">
            <Icon name="edit" size={18} />
            <input
              ref={doseRef}
              id={doseId}
              type="text"
              name="doseText"
              value={doseText}
              autoComplete="off"
              placeholder="Type what the flight surgeon told you"
              required
              onChange={(event) => setDoseText(event.target.value)}
            />
          </div>
        </div>

        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field-label" style={{ marginBottom: 8 }}>
            Confirmed by
          </legend>
          <div className="row wrap" role="radiogroup" aria-label="Confirmed by">
            {PEOPLE.map((p) => (
              <button
                key={p.value}
                type="button"
                role="radio"
                aria-checked={confirmedBy === p.value}
                className={`chip${p.initials ? " person-chip" : ""}`}
                onClick={() => setConfirmedBy(p.value)}
              >
                {p.initials ? (
                  <span className="crew-badge" style={{ width: 36, height: 36 }} aria-hidden="true">
                    {p.initials}
                  </span>
                ) : null}
                {p.label}
              </button>
            ))}
          </div>
        </fieldset>

        <label className={surgeonApproved ? "surgeon-row on" : "surgeon-row"} htmlFor={checkId}>
          <input
            id={checkId}
            type="checkbox"
            checked={surgeonApproved}
            required
            onChange={(event) => setSurgeonApproved(event.target.checked)}
          />
          <span className={`check-box${surgeonApproved ? " on" : ""}`} aria-hidden="true">
            {surgeonApproved ? <Icon name="check" size={18} strokeWidth={2.4} /> : null}
          </span>
          {surgeonApproved ? "Flight surgeon approved" : SURGEON_CHECK}
        </label>

        <p className="note watch">
          <Icon name="shield" size={16} /> Pulseframe does not suggest doses.
        </p>
        <p className="note act pill" role="note" style={{ alignSelf: "flex-start" }}>
          <Icon name="shield" size={16} /> {DISCLAIMER_COPY.emergency}
        </p>
        {error ? <p className="error">{error}</p> : null}

        <div className="dialog-actions">
          <button type="button" className="btn secondary" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={!ready}>
            <Icon name="check" size={18} /> Log as given
          </button>
        </div>
      </form>
    </dialog>
  );
}
