import { z } from "zod";
import { MEASUREMENT_KEYS, SKELETON_REGIONS } from "../../contracts";

/**
 * Shared with the emergency flow (issue 4). Cards are demonstration copy.
 * They do not name a medication or a dose. candidateItemIds point at inventory
 * ids only after a PDF comment or the researcher list supports that link.
 */
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
  immediateSteps: z.array(z.object({ title: z.string(), instruction: z.string() })),
  candidateItemIds: z.array(z.string()),
  cautions: z.string(),
  sourceNote: z.string(),
});

export type ProtocolCard = z.infer<typeof ProtocolCardSchema>;
