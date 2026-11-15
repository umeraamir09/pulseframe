import { useEffect, useRef } from "react";
import type { ChecklistItem, InventoryItem } from "../../contracts";

/** Confirm-before-taken dialog. Pulseframe never suggests or shows a dose. */
export function MedsConfirm({
  item,
  inventoryItem,
  onConfirm,
  onCancel,
}: {
  item: ChecklistItem;
  inventoryItem?: InventoryItem;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog ref={ref} className="meds-confirm" onCancel={onCancel} aria-labelledby="meds-confirm-title">
      <h2 id="meds-confirm-title">Confirm medication</h2>
      <p className="meds-name">
        {inventoryItem ? (
          <>
            {inventoryItem.name} <span className="muted">{inventoryItem.strength}</span>
          </>
        ) : (
          item.label
        )}
      </p>
      {inventoryItem ? null : <p className="muted">Item pending researcher list: not linked to the onboard inventory yet.</p>}
      <p>
        Confirm you took the scheduled medication as directed by the flight surgeon. Pulseframe does not suggest
        doses.
      </p>
      <div className="row-actions">
        <button type="button" className="primary" onClick={onConfirm}>
          Confirm
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </dialog>
  );
}
