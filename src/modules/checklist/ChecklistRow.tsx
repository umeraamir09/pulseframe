import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { Alert, ChecklistItem, InventoryItem } from "../../contracts";
import { SIM_CREW, store } from "../../data/db";
import { AlertCard } from "../../ui/AlertCard";
import { Icon } from "../../ui/Icon";
import { saveItemValue, slugOf, stampFor, unitFor } from "./checklistActions";
import { MedsConfirm } from "./MedsConfirm";

const OPEN_LINKS: Partial<Record<ChecklistItem["kind"], { to: string; label: string }>> = {
  exercise: { to: "/fitness", label: "Log" },
  radiation: { to: "/radiation", label: "Read" },
  psych: { to: "/psych", label: "Start" },
};

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Strips the long parenthetical so rows stay one line; the full label stays in the tooltip. */
function shortLabel(label: string): string {
  return label.replace(/\s*\(.*\)\s*$/, "");
}

export function ChecklistRow({
  item,
  readOnly,
  inventory,
}: {
  item: ChecklistItem;
  readOnly: boolean;
  inventory: InventoryItem[];
}) {
  const [editing, setEditing] = useState(false);
  const [v1, setV1] = useState("");
  const [v2, setV2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [confirming, setConfirming] = useState(false);

  const done = Boolean(item.doneAt);
  const unit = unitFor(item);
  const isBP = item.linkedKey === "systolicBP";
  // Scheduled meds need the confirm-before-given step; the as-needed log is a plain check.
  const isMeds = item.kind === "meds" && slugOf(item) !== "prn-med";
  const isPsych = item.kind === "psych";
  const openLink = OPEN_LINKS[item.kind];
  const inventoryItem = item.itemId ? inventory.find((i) => i.id === item.itemId) : undefined;
  const showInput = Boolean(unit) && !readOnly && (!done || editing);
  // Value rows are completed by entering the value, and psych by its own page, so their box is a status indicator.
  const boxIsToggle = !unit && !isPsych;

  async function saveValue(e: FormEvent) {
    e.preventDefault();
    if (v1.trim() === "" || (isBP && v2.trim() === "")) {
      setError(isBP ? "Enter both numbers." : "Enter a number.");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      setAlerts(await saveItemValue(item, Number(v1), isBP ? Number(v2) : undefined));
      setEditing(false);
      setV1("");
      setV2("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggle() {
    if (readOnly) return;
    if (done) {
      if (isMeds && !window.confirm("Clear this checkmark? The medication log entry is kept.")) return;
      await store.saveChecklistItem({ ...item, doneAt: undefined });
      return;
    }
    if (isMeds) {
      setConfirming(true);
      return;
    }
    await store.saveChecklistItem({ ...item, doneAt: stampFor(item.missionDay) });
  }

  async function confirmMeds() {
    const givenAt = stampFor(item.missionDay);
    if (inventoryItem) {
      await store.recordMedicationAdmin({
        crewId: SIM_CREW.id,
        itemId: inventoryItem.id,
        doseText: "As directed (simulated schedule)",
        givenAt,
        confirmedBy: "Crew A (simulated)",
      });
    }
    await store.saveChecklistItem({ ...item, doneAt: givenAt });
    setConfirming(false);
  }

  const valueText =
    done && item.value !== undefined && unit ? (isBP ? `${item.value}/${item.value2 ?? "?"}` : String(item.value)) : undefined;

  return (
    <>
      <div className={`check-row${done ? " done" : ""}`}>
        {boxIsToggle ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={done}
            aria-label={item.label}
            className={`check-box${done ? " on" : ""}`}
            disabled={readOnly}
            onClick={() => void toggle()}
          >
            {done ? <Icon name="check" size={18} strokeWidth={2.4} /> : null}
          </button>
        ) : (
          <span className={`check-box${done ? " on" : ""}`} aria-hidden="true">
            {done ? <Icon name="check" size={18} strokeWidth={2.4} /> : null}
          </span>
        )}
        <span className="label" title={[item.label, item.note].filter(Boolean).join(". ")}>
          {shortLabel(item.label)}
          {item.required ? null : <span className="optional">optional</span>}
        </span>

        {valueText && !editing ? (
          <button
            type="button"
            className="value-pill"
            style={{ border: 0, cursor: readOnly ? "default" : "pointer" }}
            onClick={() => !readOnly && setEditing(true)}
            disabled={readOnly}
            title={item.doneAt ? `Logged ${timeOf(item.doneAt)}${readOnly ? "" : ". Click to edit."}` : undefined}
          >
            {valueText} <small>{unit}</small>
          </button>
        ) : null}
        {done && !valueText && !showInput && item.doneAt ? (
          <span className="muted small">
            {isMeds ? "Given " : ""}
            {timeOf(item.doneAt)}
          </span>
        ) : null}

        {showInput && unit ? (
          <form className="check-entry" onSubmit={(e) => void saveValue(e)}>
            <label className="unit-input sm accent">
              <input
                type="number"
                step="any"
                min={0}
                inputMode="decimal"
                placeholder={isBP ? "Sys" : "Enter"}
                value={v1}
                onChange={(e) => setV1(e.target.value)}
                aria-label={isBP ? "Systolic" : item.label}
              />
              {isBP ? null : <span className="u">{unit}</span>}
            </label>
            {isBP ? (
              <label className="unit-input sm accent">
                <input
                  type="number"
                  step="any"
                  min={0}
                  inputMode="decimal"
                  placeholder="Dia"
                  value={v2}
                  onChange={(e) => setV2(e.target.value)}
                  aria-label="Diastolic"
                />
                <span className="u">{unit}</span>
              </label>
            ) : null}
            <button type="submit" className="btn primary sm" disabled={busy} aria-label={`Save ${item.label}`}>
              <Icon name="check" size={18} />
            </button>
            {editing ? (
              <button type="button" className="btn ghost sm" onClick={() => setEditing(false)} aria-label="Cancel">
                <Icon name="x" size={18} />
              </button>
            ) : null}
          </form>
        ) : null}

        {!done && isMeds && !readOnly ? (
          <button type="button" className="btn primary sm" onClick={() => setConfirming(true)}>
            <Icon name="shield" size={18} /> Confirm before given
          </button>
        ) : null}
        {!done && openLink && !showInput && !readOnly ? (
          <Link to={openLink.to} className="btn secondary sm">
            {openLink.label}
          </Link>
        ) : null}
      </div>
      {error ? <p className="error">{error}</p> : null}
      {alerts.map((a) => (
        <AlertCard key={a.id} alert={a} compact />
      ))}

      {confirming ? (
        <MedsConfirm
          item={item}
          inventoryItem={inventoryItem}
          onConfirm={() => void confirmMeds()}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </>
  );
}
