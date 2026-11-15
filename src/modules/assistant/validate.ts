import { z } from "zod";
import type { InventoryItem, Recommendation } from "../../contracts";

export const RecommendationDraftSchema = z.object({
  itemIds: z.array(z.string()),
  rationale: z.string(),
  cautions: z.string(),
});

/** Stable id so saving the same suggestion twice overwrites one row. */
export function recommendationId(caseId: string, itemIds: string[], rationale: string, cautions: string): string {
  const raw = `${caseId}\n${itemIds.join("\n")}\n${rationale}\n${cautions}`;
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `rec-${(hash >>> 0).toString(16)}`;
}

export function validateRecommendation(
  raw: unknown,
  inventory: InventoryItem[],
  caseId: string,
  offline: boolean,
): { recommendation?: Recommendation; rejectedItemIds: string[]; error?: string } {
  const parsed = RecommendationDraftSchema.safeParse(raw);
  if (!parsed.success) {
    return { rejectedItemIds: [], error: "Recommendation draft did not match the expected shape." };
  }

  const allowed = new Set(inventory.map((item) => item.id));
  const itemIds: string[] = [];
  const rejectedItemIds: string[] = [];
  const seen = new Set<string>();
  for (const itemId of parsed.data.itemIds) {
    if (seen.has(itemId)) continue;
    seen.add(itemId);
    if (allowed.has(itemId)) itemIds.push(itemId);
    else rejectedItemIds.push(itemId);
  }

  const recommendation: Recommendation = {
    id: recommendationId(caseId, itemIds, parsed.data.rationale, parsed.data.cautions),
    caseId,
    itemIds,
    rationale: parsed.data.rationale,
    cautions: parsed.data.cautions,
    needsSurgeonReview: true,
    createdAt: new Date().toISOString(),
    offlineFallback: offline,
  };
  return { recommendation, rejectedItemIds };
}
