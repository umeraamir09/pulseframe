import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { UNITS, type Alert, type ChecklistItem, type InventoryItem } from "../../contracts";
import { SIM_CREW, missionDayStart, store } from "../../data/db";
import { AlertCard } from "../../ui/AlertCard";
import { Icon } from "../../ui/Icon";
import { MedsConfirm } from "./MedsConfirm";

const OPEN_LINKS: Partial<Record<ChecklistItem["kind"], { to: string; label: string }>> = {
  exercise: { to: "/fitness", label: "Log" },
  radiation: { to: "/radiation", label: "Read" },
  psych: { to: "/psych", label: "Start" },
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
  const isBP = item.linkedKey === "systolicBP";
  const openLink = OPEN_LINKS[item.kind];
  const inventoryItem = item.itemId ? inventory.find((i) => i.id === item.itemId) : undefined;
  const showInput = Boolean(item.linkedKey) && !readOnly && (!done || editing);
  const unit = item.linkedKey ? UNITS[item.linkedKey] : "";

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

  const valueText =
    done && item.value !== undefined && item.linkedKey ? (isBP ? `${item.value}/${item.value2 ?? "?"}` : String(item.value)) : undefined;

  return (
    <>
      <div className={`check-row${done ? " done" : ""}`}>
        {item.linkedKey ? (
          <span className={`check-box${done ? " on" : ""}`} aria-hidden="true">
            {done ? <Icon name="check" size={18} strokeWidth={2.4} /> : null}
          </span>
        ) : (
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
        {done && !item.linkedKey && item.doneAt ? <span className="muted small">{timeOf(item.doneAt)}</span> : null}

        {showInput && item.linkedKey ? (
          <form className="check-entry" onSubmit={(e) => void saveValue(e)}>
            <label className="unit-input sm accent">
              <input
                type="number"
                step="any"
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

        {!done && item.kind === "meds" && !readOnly ? (
          <button type="button" className="btn primary sm" onClick={() => setConfirming(true)}>
            <Icon name="shield" size={18} /> Confirm before given
          </button>
        ) : null}
        {!done && openLink && !readOnly ? (
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
