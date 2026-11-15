import { useEffect, useRef, useState } from "react";
import type { InventoryItem } from "../../contracts";
import { store, useLive } from "../../data/db";
import { Icon } from "../../ui/Icon";
import type { ProtocolCard } from "../protocols";
import { NO_ONBOARD_ITEM, REJECTED_LINE } from "./copy";
import { KitItemCard } from "./Formulary";
import { offlineProvider, type CaseContext } from "./providers";
import { validateRecommendation } from "./validate";

/**
 * Onboard suggestions for one case, shared by the assistant and the emergency kit stage.
 * Suggestions come from the offline provider, then validateRecommendation drops any id that is not in inventory.
 */
export function KitSuggestions({
  caseId,
  card,
  onGive,
  embedded,
}: {
  caseId: string;
  card?: ProtocolCard;
  onGive?: (item: InventoryItem) => void;
  /** Rendered inside the emergency kit card: no outer card or heading. */
  embedded?: boolean;
}) {
  const inventoryLive = useLive(() => store.listInventory(), []);
  const caseLive = useLive(() => store.getCase(caseId), [caseId]);
  const inventory = inventoryLive.data;
  const openCase = caseLive.data;
  const [text, setText] = useState("");
  const [keptIds, setKeptIds] = useState<string[] | null>(null);
  const [rejected, setRejected] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const saved = useRef("");

  useEffect(() => {
    if (!inventory || !openCase) return;
    let cancel = false;
    const caseCtx: CaseContext = {
      caseId,
      crewId: openCase.crewId,
      narrative: openCase.narrative,
      regionIds: openCase.regionIds,
      protocolId: card?.id ?? openCase.protocolId,
    };
    void (async () => {
      const reply = await offlineProvider.ask({ command: "suggest", caseCtx, inventory });
      if (cancel) return;
      const result = validateRecommendation(reply.draft, inventory, caseId, true);
      if (cancel) return;
      setText(reply.text);
      setRejected(result.rejectedItemIds);
      if (!result.recommendation) {
        setError(result.error ?? "Could not read the protocol card.");
        setKeptIds([]);
        return;
      }
      setError(undefined);
      setKeptIds(result.recommendation.itemIds);
      if (saved.current === result.recommendation.id) return;
      saved.current = result.recommendation.id;
      await store.saveRecommendation(result.recommendation);
    })();
    return () => {
      cancel = true;
    };
  }, [inventory, openCase, caseId, card?.id]);

  const kept = (keptIds ?? [])
    .map((id) => inventory?.find((item) => item.id === id))
    .filter((item): item is InventoryItem => item !== undefined);
  const lines = text.split("\n").filter(Boolean);

  const content = (
    <>
      {caseLive.loading || inventoryLive.loading ? <p className="muted">Checking the protocol card…</p> : null}
      {!caseLive.loading && !openCase ? <p>No open case. Start one in Emergency.</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {kept.length > 0 ? (
        <ul className="formulary-grid" style={{ marginTop: 0 }}>
          {kept.map((item) => (
            <KitItemCard key={item.id} item={item} white showProvenance onConfirm={onGive} />
          ))}
        </ul>
      ) : keptIds !== null && openCase ? (
        <div className="kit-card white">
          <div className="row">
            <span className="icon-badge sm accent">
              <Icon name="kit" size={16} />
            </span>
            <span className="name">No onboard item suggested</span>
          </div>
          <p className="muted small">{lines.find((l) => l === NO_ONBOARD_ITEM) ?? NO_ONBOARD_ITEM}</p>
          {lines
            .filter((l) => l !== NO_ONBOARD_ITEM)
            .map((l, i) => (
              <p key={i} className="small">
                {l}
              </p>
            ))}
        </div>
      ) : null}
      {kept.length > 0 ? (
        <p className="note watch">
          <Icon name="shield" size={16} /> Pulseframe does not suggest doses.
        </p>
      ) : null}
      {rejected.length > 0 ? (
        <div className="row wrap">
          <span className="tag act">
            <Icon name="ban" size={14} /> {REJECTED_LINE}
          </span>
          <span className="muted small">Only onboard kit items are shown. Dropped: {rejected.join(", ")}</span>
        </div>
      ) : null}
    </>
  );

  if (embedded) return <div className="stack">{content}</div>;

  return (
    <section className="reply-card" aria-labelledby="kit-suggest-title">
      <div className="reply-head">
        <span className="icon-badge sm accent sq">
          <Icon name="kit" size={16} />
        </span>
        <h2 id="kit-suggest-title" className="h3">
          {keptIds === null ? "Onboard kit" : `${kept.length} ${kept.length === 1 ? "match" : "matches"} for the open case`}
        </h2>
        <span className="tag">Protocol card</span>
      </div>
      {content}
    </section>
  );
}
