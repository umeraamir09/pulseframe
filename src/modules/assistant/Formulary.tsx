import { useMemo, useState } from "react";
import type { InventoryItem } from "../../contracts";
import { PROVENANCE_LABEL } from "./copy";

function provenance(item: InventoryItem): string {
  return item.provenance === "historical-demo-subset" ? PROVENANCE_LABEL : "Researcher list";
}

/** Onboard formulary. Every row is an inventory item. Strength is the checklist label, not a dose. */
export function Formulary({
  items,
  onConfirm,
}: {
  items: InventoryItem[] | undefined;
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
    return rows.filter((item) =>
      `${item.name} ${item.comments} ${item.id} ${item.route}`.toLowerCase().includes(needle),
    );
  }, [items, filter]);

  return (
    <section className="formulary" aria-labelledby="formulary-title">
      <header className="formulary-head">
        <div>
          <h2 id="formulary-title">Onboard formulary</h2>
          <p>NASA ISS kit, historical demonstration subset</p>
        </div>
        <label className="filter">
          <span className="sr">Filter</span>
          <input
            value={filter}
            placeholder="Filter"
            onChange={(event) => setFilter(event.target.value)}
            aria-label="Filter formulary"
          />
        </label>
      </header>
      <p className="prov-label">{PROVENANCE_LABEL}</p>
      {items === undefined ? (
        <p className="muted">Loading the onboard kit…</p>
      ) : shown.length === 0 ? (
        <p className="muted">No formulary item matches that filter.</p>
      ) : (
        <ul className="formulary-grid">
          {shown.map((item) => (
            <li key={item.id} className="kit-card">
              <h3>{item.name}</h3>
              <p className="muted small">{item.pack}</p>
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
              <p className="prov-label">{provenance(item)}</p>
              <p className="pdf-link">
                <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                  NASA checklist PDF
                </a>
                {item.sourcePage ? <span>page {item.sourcePage}</span> : null}
              </p>
              <button type="button" className="give-btn" onClick={() => onConfirm(item)}>
                Confirm before given
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="dose-warn">Pulseframe does not suggest doses. Meds need crew confirmation.</p>
    </section>
  );
}
