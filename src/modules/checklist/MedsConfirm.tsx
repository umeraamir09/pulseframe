import { useEffect, useRef } from "react";
import type { ChecklistItem, InventoryItem } from "../../contracts";
import { Icon } from "../../ui/Icon";

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
    <dialog ref={ref} className="given-dialog" onCancel={onCancel} aria-labelledby="meds-confirm-title">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm();
        }}
      >
        <header className="given-head">
          <span className="icon-badge lg watch sq">
            <Icon name="shield" size={22} />
          </span>
          <div className="grow">
            <h2 id="meds-confirm-title" className="h2">
              Confirm before given
            </h2>
            <p>Crew confirms. Pulseframe only records it.</p>
          </div>
          <button type="button" className="icon-round" style={{ background: "var(--surface2)" }} onClick={onCancel} aria-label="Close">
            <Icon name="x" size={20} />
          </button>
        </header>
        <div className="item-row">
          <span className="icon-badge white">
            <Icon name="pill" size={18} />
          </span>
          <div className="grow">
            <div className="t">{inventoryItem ? inventoryItem.name : item.label}</div>
            <div className="d">
              {inventoryItem ? inventoryItem.strength : "Item pending researcher list: not linked to the onboard inventory yet."}
            </div>
          </div>
        </div>
        <p>Confirm you took the scheduled medication as directed by the flight surgeon.</p>
        <p className="note watch pill">
          <Icon name="shield" size={16} /> Pulseframe does not suggest doses.
        </p>
        <div className="dialog-actions">
          <button type="button" className="btn secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            <Icon name="check" size={18} /> Confirm
          </button>
        </div>
      </form>
    </dialog>
  );
}
