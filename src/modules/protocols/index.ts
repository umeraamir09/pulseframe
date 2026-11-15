import type { SkeletonRegionId } from "../../contracts/index.ts";
import bleedingCard from "./cards/bleeding-laceration-abrasion.json" with { type: "json" };
import chestCard from "./cards/chest-tightness-post-exercise.json" with { type: "json" };
import chokingCard from "./cards/choking-airway.json" with { type: "json" };
import eyeCard from "./cards/eye-foreign-body-abrasion.json" with { type: "json" };
import fireCard from "./cards/fire-smoke-burns.json" with { type: "json" };
import fallbackCard from "./cards/general-fallback.json" with { type: "json" };
import headacheCard from "./cards/headache-co2.json" with { type: "json" };
import smsCard from "./cards/space-motion-sickness.json" with { type: "json" };
import { ProtocolCardSchema, type ProtocolCard, type ProtocolSource } from "./schema.ts";

/**
 * Protocol cards shared with the emergency flow (issue 4).
 * The chest card and the fallback are team demonstration cards with no kit items.
 * The other six come from the researcher (research/protocols). Their
 * candidateItemIds name onboard kit ids and never a dose (decisions.md section 1).
 * The general fallback stays last.
 */
export const PROTOCOL_CARDS: ProtocolCard[] = [
  chestCard,
  chokingCard,
  bleedingCard,
  fireCard,
  eyeCard,
  headacheCard,
  smsCard,
  fallbackCard,
].map((card) => ProtocolCardSchema.parse(card));

export const GENERAL_FALLBACK_ID = "general-fallback";

export type { ProtocolCard, ProtocolSource };

export function getProtocol(id: string): ProtocolCard | undefined {
  return PROTOCOL_CARDS.find((card) => card.id === id);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Keyword hits match at the start of a word, so "hot" does not hit "shot" and "cut" does not hit "acute". */
function keywordHit(text: string, keyword: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(keyword.toLowerCase())}`).test(text);
}

/**
 * Region overlap counts double. A card needs at least one keyword hit to win,
 * because many cards share a region (most include the head). No keyword hit
 * returns the fallback card. Ties keep the earlier card in PROTOCOL_CARDS.
 */
export function matchProtocol(narrative: string, regionIds: SkeletonRegionId[]): ProtocolCard {
  const text = narrative.toLowerCase();
  const fallback = getProtocol(GENERAL_FALLBACK_ID) ?? PROTOCOL_CARDS[PROTOCOL_CARDS.length - 1]!;
  let best = fallback;
  let bestScore = 0;
  for (const card of PROTOCOL_CARDS) {
    if (card.id === GENERAL_FALLBACK_ID) continue;
    const keywordHits = card.keywords.filter((keyword) => keywordHit(text, keyword)).length;
    if (keywordHits === 0) continue;
    const regionHits = card.regionIds.filter((region) => regionIds.includes(region)).length;
    const score = regionHits * 2 + keywordHits;
    if (score > bestScore) {
      best = card;
      bestScore = score;
    }
  }
  return best;
}
