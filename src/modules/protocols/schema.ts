import { z } from "zod";
import { MEASUREMENT_KEYS, SKELETON_REGIONS } from "../../contracts";

/**
 * Shared with the emergency flow (issue 4). Cards do not give a dose
 * (research/decisions.md section 1). candidateItemIds point at inventory ids
 * only when a researcher note or a kit list comment supports that link.
 *
 * The team cards use only the required fields. The researcher cards (PF-S2)
 * add the optional fields below. Every one of them is research data marked
 * `safety: true` and needs a second-person review before it changes behavior.
 */

/** A = NASA or peer reviewed, B = reputable secondary, C = general medicine, ? = not found. */
export const ConfidenceSchema = z.enum(["A", "B", "C", "?"]);

export const ProtocolSourceSchema = z.object({
  /** Card-local id such as `s1`. Steps and time limits cite it. */
  id: z.string(),
  url: z.string(),
  title: z.string(),
  section: z.string(),
  quote: z.string(),
  accessed: z.string(),
  confidence: ConfidenceSchema,
  usedFor: z.string(),
});

export const TimeLimitSchema = z.object({
  item: z.string(),
  safety: z.boolean(),
  sourceIds: z.array(z.string()),
});

export const WhenGroundUnavailableSchema = z.object({
  status: z.string(),
  detail: z.string(),
  firstAidThatNeedsNoGround: z.array(z.string()),
  sourceIds: z.array(z.string()),
});

/** A measurement key the card would use but that is not in contracts/keys.ts yet. Dev B decides. */
export const ProposedKeySchema = z.object({
  key: z.string(),
  unit: z.string(),
  reason: z.string(),
});

export const ProtocolCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  regionIds: z.array(z.enum(SKELETON_REGIONS)),
  keywords: z.array(z.string()),
  differential: z.array(z.object({ label: z.string(), note: z.string() })),
  tests: z.array(
    z.object({
      title: z.string(),
      instruction: z.string(),
      inputKey: z.enum(MEASUREMENT_KEYS).optional(),
    }),
  ),
  immediateSteps: z.array(
    z.object({ title: z.string(), instruction: z.string(), sourceIds: z.array(z.string()).optional() }),
  ),
  candidateItemIds: z.array(z.string()),
  cautions: z.string(),
  sourceNote: z.string(),

  // Researcher card fields (PF-S2). Optional so the team cards still parse.
  redFlagsLifeThreat: z.array(z.string()).optional(),
  redFlagsCallGround: z.array(z.string()).optional(),
  timeLimits: z.array(TimeLimitSchema).optional(),
  whenGroundUnavailable: WhenGroundUnavailableSchema.optional(),
  proposedKeys: z.array(ProposedKeySchema).optional(),
  candidateItemNotes: z.string().optional(),
  /** Ids from research/equipment.json. */
  equipmentIds: z.array(z.string()).optional(),
  gaps: z.array(z.string()).optional(),
  /** For example `iss-historical` or `iss-current`. */
  environment: z.string().optional(),
  safety: z.boolean().optional(),
  sources: z.array(ProtocolSourceSchema).optional(),
});

export type ProtocolCard = z.infer<typeof ProtocolCardSchema>;
export type ProtocolSource = z.infer<typeof ProtocolSourceSchema>;
