import type { SkeletonRegionId } from "../../contracts";
import chestCard from "./cards/chest-tightness-post-exercise.json" with { type: "json" };
import fallbackCard from "./cards/general-fallback.json" with { type: "json" };
import { ProtocolCardSchema, type ProtocolCard } from "./schema";

/**
 * Protocol cards shared with the emergency flow (issue 4).
 * candidateItemIds stay empty: no comment in the NASA ISS medical kit checklist
 * states an indication for these demonstration cards, so suggest will not name
 * an onboard item until a researcher list or a matching PDF comment exists.
 */
export const PROTOCOL_CARDS: ProtocolCard[] = [
  ProtocolCardSchema.parse(chestCard),
  ProtocolCardSchema.parse(fallbackCard),
];

export const GENERAL_FALLBACK_ID = "general-fallback";

export type { ProtocolCard };

export function getProtocol(id: string): ProtocolCard | undefined {
  return PROTOCOL_CARDS.find((card) => card.id === id);
}

/** Region overlap counts double. Keyword hits are substring matches. Score 0 returns the fallback card. */
export function matchProtocol(narrative: string, regionIds: SkeletonRegionId[]): ProtocolCard {
  const text = narrative.toLowerCase();
  const fallback = getProtocol(GENERAL_FALLBACK_ID) ?? PROTOCOL_CARDS[PROTOCOL_CARDS.length - 1]!;
  let best = fallback;
  let bestScore = 0;
  for (const card of PROTOCOL_CARDS) {
    if (card.id === GENERAL_FALLBACK_ID) continue;
    const regionHits = card.regionIds.filter((region) => regionIds.includes(region)).length;
    const keywordHits = card.keywords.filter((keyword) => text.includes(keyword.toLowerCase())).length;
    const score = regionHits * 2 + keywordHits;
    if (score > bestScore) {
      best = card;
      bestScore = score;
    }
  }
  return bestScore === 0 ? fallback : best;
}
