import { useMemo, useState } from "react";
import type { InventoryItem } from "../../contracts";
import { Icon } from "../../ui/Icon";
import { PROVENANCE_LABEL } from "./copy";

/** One onboard item. Strength is the checklist label, not a dose. */
export function KitItemCard({
  item,
  selected,
  white,
  onConfirm,
  showProvenance,
}: {
  item: InventoryItem;
  selected?: boolean;
  white?: boolean;
  onConfirm?: (item: InventoryItem) => void;
  showProvenance?: boolean;
}) {
  return (
    <li className={`kit-card${selected ? " selected" : ""}${white ? " white" : ""}`}>
      <div className="row">
        <span className="icon-badge sm white" style={{ color: "var(--accent)" }}>
          <Icon name="pill" size={16} />
        </span>
        <h3 className="name" title={item.pack}>
          {item.name}
        </h3>
      </div>
      {showProvenance ? (
        <p className="prov">
          <Icon name="kit" size={12} /> {PROVENANCE_LABEL}
        </p>
      ) : null}
      <dl className="kit-dl">
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
          <dd title={item.comments}>{item.comments ? clip(item.comments, 70) : "Not stated in the checklist"}</dd>
        </div>
      </dl>
      <a className="small" href={item.sourceUrl} target="_blank" rel="noreferrer">
        Source PDF{item.sourcePage ? `, page ${item.sourcePage}` : ""}
      </a>
      {onConfirm ? (
        <button type="button" className="btn watch-outline" style={{ alignSelf: "flex-start" }} onClick={() => onConfirm(item)}>
          <Icon name="shield" size={14} /> Confirm before given
        </button>
      ) : null}
    </li>
  );
}

function clip(text: string, n: number): string {
  return text.length > n ? `${text.slice(0, n - 1).trimEnd()}…` : text;
}

/** Onboard formulary. Every row is an inventory item. */
export function Formulary({
  items,
  selected,
  onConfirm,
}: {
  items: InventoryItem[] | undefined;
  selected?: string;
  onConfirm: (item: InventoryItem) => void;
}) {
  const [filter, setFilter] = useState("");
  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const rows = [...(items ?? [])].sort((a, b) => {
      const page = (a.sourcePage ?? "").localeCompare(b.sourcePage ?? "", undefined, { numeric: true });
      return page || a.name.localeCompare(b.name);
    });
    if (!needle) return rows;
    return rows.filter((item) => `${item.name} ${item.comments} ${item.id} ${item.route}`.toLowerCase().includes(needle));
  }, [items, filter]);

  return (
    <section className="card" aria-labelledby="formulary-title">
      <div className="card-head">
        <div className="titles">
          <h2 id="formulary-title" className="h3" style={{ fontSize: 20 }}>
            Onboard formulary
          </h2>
          <p className="muted small">NASA ISS medical kit checklist (MED CL/SpX-6, 2015)</p>
        </div>
        <label className="unit-input sm" style={{ background: "var(--surface2)", borderColor: "transparent" }}>
          <Icon name="search" size={16} />
          <input
            type="search"
            value={filter}
            placeholder="Filter"
            onChange={(event) => setFilter(event.target.value)}
            aria-label="Filter formulary"
            style={{ width: "5.5rem" }}
          />
        </label>
      </div>
      {items === undefined ? (
        <p className="muted" style={{ marginTop: 16 }}>
          Loading the onboard kit…
        </p>
      ) : shown.length === 0 ? (
        <p className="muted" style={{ marginTop: 16 }}>
          No formulary item matches that filter.
        </p>
      ) : (
        <ul className="formulary-grid">
          {shown.map((item) => (
            <KitItemCard key={item.id} item={item} selected={item.id === selected} onConfirm={onConfirm} />
          ))}
        </ul>
      )}
      <p className="note watch" style={{ marginTop: 16 }}>
        <Icon name="shield" size={16} /> Pulseframe does not suggest doses. Meds need crew confirmation.
      </p>
    </section>
  );
}
