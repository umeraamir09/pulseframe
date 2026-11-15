import { useEffect, useRef, useState } from "react";
import type { InventoryItem } from "../../contracts";
import { store, useLive } from "../../data/db";
import type { ProtocolCard } from "../protocols";
import { PROVENANCE_LABEL, REJECTED_LINE } from "./copy";
import { offlineProvider, type CaseContext } from "./providers";
import { validateRecommendation } from "./validate";

/**
 * Onboard suggestions for one case. The emergency kit stage can render this
 * with the same props once issue 4 lands. Suggestions come from the offline
 * provider, then validateRecommendation drops any id that is not in inventory.
 */
export function KitSuggestions({
  caseId,
  card,
  onGive,
}: {
  caseId: string;
  card?: ProtocolCard;
  onGive?: (item: InventoryItem) => void;
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

  return (
    <section className="kit-suggest" aria-labelledby="kit-suggest-title">
      <header>
        <h2 id="kit-suggest-title">
          {keptIds === null
            ? "Onboard kit"
            : `${kept.length} ${kept.length === 1 ? "match" : "matches"} in onboard kit`}
        </h2>
        <p className="prov-label">{PROVENANCE_LABEL}</p>
      </header>
      {caseLive.loading || inventoryLive.loading ? <p className="muted">Checking the protocol card…</p> : null}
      {!caseLive.loading && !openCase ? <p>No open case. Start one in Emergency.</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {text && openCase ? (
        <div className="reply-text">
          {text.split("\n").map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>
      ) : null}
      {kept.length > 0 ? (
        <ul className="suggest-list">
          {kept.map((item) => (
            <li key={item.id} className="kit-card">
              <h3>{item.name}</h3>
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
              <p className="prov-label">{PROVENANCE_LABEL}</p>
              {onGive ? (
                <button type="button" className="give-btn" onClick={() => onGive(item)}>
                  Mark as given
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {rejected.length > 0 ? (
        <p className="rejected-line">
          {REJECTED_LINE}
          <span className="rejected-ids">{rejected.join(", ")}</span>
          <span className="muted">Only onboard kit items are shown.</span>
        </p>
      ) : null}
    </section>
  );
}
