import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { Alert, ChecklistItem, InventoryItem } from "../../contracts";
import { SIM_CREW, store } from "../../data/db";
import { AlertCard } from "../../ui/AlertCard";
import checkIcon from "../../assets/icons/checklist/check-white.svg";
import infoIcon from "../../assets/icons/checklist/info.svg";
import shieldIcon from "../../assets/icons/checklist/shield-white.svg";
import { saveItemValue, slugOf, stampFor, unitFor } from "./checklistActions";
import { MedsConfirm } from "./MedsConfirm";

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
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
  const inventoryItem = item.itemId ? inventory.find((i) => i.id === item.itemId) : undefined;
  const showInput = Boolean(unit) && !readOnly && (!done || editing);

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

  // Value rows are completed by entering the value, so their box is a status indicator, not a toggle.
  const boxIsToggle = !unit && !isPsych && !readOnly;

  return (
    <li className={`cl-item${done ? " is-done" : ""}`}>
      <div className="cl-item-main">
        {boxIsToggle ? (
          <button
            type="button"
            className="cl-box"
            aria-pressed={done}
            aria-label={done ? `Mark "${item.label}" not done` : `Mark "${item.label}" done`}
            onClick={() => void toggle()}
          >
            {done ? <img src={checkIcon} alt="" width={18} height={18} /> : null}
          </button>
        ) : (
          <span className="cl-box" aria-hidden="true">
            {done ? <img src={checkIcon} alt="" width={18} height={18} /> : null}
          </span>
        )}

        <div className="cl-label">
          <span className="cl-label-text">{item.label}</span>
          {item.required ? null : <span className="cl-optional">Optional</span>}
          {item.note ? (
            item.sourceUrl ? (
              <a
                className="cl-info"
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer"
                title={item.note}
                aria-label={`About this item: ${item.note} (opens source)`}
              >
                <img src={infoIcon} alt="" width={14} height={14} />
              </a>
            ) : (
              <span className="cl-info" title={item.note} aria-label={`About this item: ${item.note}`} role="img">
                <img src={infoIcon} alt="" width={14} height={14} />
              </span>
            )
          ) : null}
        </div>

        <div className="cl-side">
          {showInput && unit ? (
            <form className="cl-entry" onSubmit={(e) => void saveValue(e)}>
              <input
                type="number"
                step="any"
                min={0}
                inputMode="decimal"
                placeholder={isBP ? "Sys" : "Enter"}
                value={v1}
                onChange={(e) => setV1(e.target.value)}
                aria-label={isBP ? `${item.label}, systolic` : item.label}
                autoFocus={editing}
              />
              {isBP ? (
                <>
                  <span className="cl-entry-sep">/</span>
                  <input
                    type="number"
                    step="any"
                    min={0}
                    inputMode="decimal"
                    placeholder="Dia"
                    value={v2}
                    onChange={(e) => setV2(e.target.value)}
                    aria-label={`${item.label}, diastolic`}
                  />
                </>
              ) : null}
              <span className="cl-unit">{unit}</span>
              {v1.trim() !== "" ? (
                <button type="submit" className="cl-entry-save" disabled={busy} aria-label={`Save ${item.label}`}>
                  <img src={checkIcon} alt="" width={14} height={14} />
                </button>
              ) : null}
              {editing ? (
                <button type="button" className="cl-entry-cancel" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              ) : null}
            </form>
          ) : done && unit && item.value !== undefined ? (
            <button
              type="button"
              className="cl-value"
              disabled={readOnly}
              onClick={() => setEditing(true)}
              title={readOnly ? undefined : "Edit value"}
            >
              <strong>{isBP ? `${fmt(item.value)}/${item.value2 !== undefined ? fmt(item.value2) : "?"}` : fmt(item.value)}</strong>
              <span>{unit}</span>
            </button>
          ) : done && item.doneAt ? (
            <span className="cl-value">
              <span>{isMeds ? "Given" : "Done"}</span>
              <strong>{timeOf(item.doneAt)}</strong>
            </span>
          ) : isMeds && !readOnly ? (
            <button type="button" className="cl-btn cl-btn-primary" onClick={() => setConfirming(true)}>
              <img src={shieldIcon} alt="" width={18} height={18} />
              Confirm before given
            </button>
          ) : isPsych && !readOnly ? (
            <Link className="cl-btn cl-btn-secondary" to="/psych">
              Start
            </Link>
          ) : null}
        </div>
      </div>

      {error ? <p className="cl-error">{error}</p> : null}
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
    </li>
  );
}
