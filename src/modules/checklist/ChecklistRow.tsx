import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { UNITS, type Alert, type ChecklistItem, type InventoryItem } from "../../contracts";
import { SIM_CREW, missionDayStart, store } from "../../data/db";
import { AlertCard } from "../../ui/AlertCard";
import { MedsConfirm } from "./MedsConfirm";

const OPEN_LINKS: Partial<Record<ChecklistItem["kind"], string>> = {
  exercise: "/fitness",
  radiation: "/radiation",
  psych: "/psych",
};

/** A timestamp on the item's mission day at the current time of day. */
function stampFor(missionDay: string): string {
  const now = new Date();
  const d = missionDayStart(Number(missionDay));
  d.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
  return (d > now ? now : d).toISOString();
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
  const isBP = item.linkedKey === "systolicBP";
  const openLink = OPEN_LINKS[item.kind];
  const inventoryItem = item.itemId ? inventory.find((i) => i.id === item.itemId) : undefined;
  const showInput = item.linkedKey && !readOnly && (!done || editing);

  async function saveValue(e: FormEvent) {
    e.preventDefault();
    if (!item.linkedKey) return;
    const a = Number(v1);
    const b = Number(v2);
    if (v1.trim() === "" || !Number.isFinite(a) || (isBP && (v2.trim() === "" || !Number.isFinite(b)))) {
      setError("Enter a number.");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const takenAt = stampFor(item.missionDay);
      const writes = [{ key: item.linkedKey, value: a }];
      if (isBP) writes.push({ key: "diastolicBP", value: b });
      const results = [];
      for (const w of writes) {
        results.push(
          await store.recordMeasurement({
            crewId: SIM_CREW.id,
            key: w.key,
            value: w.value,
            unit: UNITS[w.key],
            source: "checklist",
            takenAt,
          }),
        );
      }
      setAlerts(results.flatMap((r) => (r.alert ? [r.alert] : [])));
      await store.saveChecklistItem({ ...item, value: a, value2: isBP ? b : undefined, doneAt: takenAt });
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
      if (item.kind === "meds" && !window.confirm("Clear this checkmark? The medication log entry is kept.")) return;
      await store.saveChecklistItem({ ...item, doneAt: undefined });
      return;
    }
    if (item.kind === "meds") {
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

  return (
    <li className={`check-row${done ? " done" : ""}`}>
      <div className="check-main">
        {item.linkedKey ? (
          <span className={`check-dot${done ? " on" : ""}`} aria-hidden="true" />
        ) : (
          <input
            type="checkbox"
            checked={done}
            disabled={readOnly}
            onChange={() => void toggle()}
            aria-label={item.label}
          />
        )}
        <div className="check-text">
          <span className="check-label">
            {item.label}
            {item.required ? null : <span className="optional"> optional</span>}
          </span>
          {item.note ? (
            <span className="muted check-note">
              {item.note}
              {item.sourceUrl ? (
                <>
                  {" "}
                  <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                    Source
                  </a>
                </>
              ) : null}
            </span>
          ) : null}
        </div>
        <div className="check-side">
          {done && item.value !== undefined && item.linkedKey ? (
            <span className="check-value">
              {isBP ? `${item.value}/${item.value2 ?? "?"}` : item.value} {UNITS[item.linkedKey]}
            </span>
          ) : null}
          {done && item.doneAt ? <span className="muted">{timeOf(item.doneAt)}</span> : null}
          {done && item.linkedKey && !readOnly && !editing ? (
            <button type="button" className="link-btn" onClick={() => setEditing(true)}>
              Edit
            </button>
          ) : null}
          {openLink ? <Link to={openLink}>Open</Link> : null}
        </div>
      </div>

      {showInput && item.linkedKey ? (
        <form className="check-input" onSubmit={(e) => void saveValue(e)}>
          <input
            type="number"
            step="any"
            inputMode="decimal"
            placeholder={isBP ? "Systolic" : "Value"}
            value={v1}
            onChange={(e) => setV1(e.target.value)}
            aria-label={isBP ? "Systolic" : item.label}
          />
          {isBP ? (
            <>
              <span>/</span>
              <input
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="Diastolic"
                value={v2}
                onChange={(e) => setV2(e.target.value)}
                aria-label="Diastolic"
              />
            </>
          ) : null}
          <span className="muted">{UNITS[item.linkedKey]}</span>
          <button type="submit" className="primary" disabled={busy}>
            Save
          </button>
          {editing ? (
            <button type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          ) : null}
          {error ? <span className="error">{error}</span> : null}
        </form>
      ) : null}

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
