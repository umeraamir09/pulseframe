/**
 * Visual answer blocks shared by /api/assistant and the assistant page.
 *
 * The model returns a short lead `text` plus up to MAX_BLOCKS typed blocks.
 * The server checks and trims them (api/_lib/assistantPrompt.ts finalizeAnswer);
 * the client parses them again with these schemas and drops any it cannot read.
 * `cite` holds research pack chunk ids; general answers carry none.
 */
import { z } from "zod";

export const MAX_BLOCKS = 4;
export const MAX_BLOCK_ITEMS = 6;

export const ANSWER_KINDS = ["research", "general", "notFound"] as const;
export type AnswerKind = (typeof ANSWER_KINDS)[number];

const cite = z.array(z.string());

export const FactsBlockSchema = z.object({
  type: z.literal("facts"),
  title: z.string(),
  items: z.array(z.object({ label: z.string(), value: z.string(), cite })),
});

export const RangeBlockSchema = z.object({
  type: z.literal("range"),
  label: z.string(),
  low: z.number().nullable(),
  high: z.number().nullable(),
  unit: z.string(),
  note: z.string(),
  cite,
});

export const StepsBlockSchema = z.object({
  type: z.literal("steps"),
  title: z.string(),
  items: z.array(z.object({ title: z.string(), detail: z.string(), cite })),
});

export const WarningBlockSchema = z.object({
  type: z.literal("warning"),
  title: z.string(),
  items: z.array(z.string()),
  cite,
});

export const ListBlockSchema = z.object({
  type: z.literal("list"),
  title: z.string(),
  items: z.array(z.object({ text: z.string(), cite })),
});

export const AnswerBlockSchema = z.discriminatedUnion("type", [
  FactsBlockSchema,
  RangeBlockSchema,
  StepsBlockSchema,
  WarningBlockSchema,
  ListBlockSchema,
]);

export type FactsBlock = z.infer<typeof FactsBlockSchema>;
export type RangeBlock = z.infer<typeof RangeBlockSchema>;
export type StepsBlock = z.infer<typeof StepsBlockSchema>;
export type WarningBlock = z.infer<typeof WarningBlockSchema>;
export type ListBlock = z.infer<typeof ListBlockSchema>;
export type AnswerBlock = z.infer<typeof AnswerBlockSchema>;

/** Block types a general (uncited) answer may use. Ranges and warnings state medical facts, so they need research. */
export const GENERAL_BLOCK_TYPES: ReadonlySet<AnswerBlock["type"]> = new Set(["facts", "steps", "list"]);

/** Keep the blocks that parse, at most MAX_BLOCKS. Never throws. */
export function parseBlocks(raw: unknown): AnswerBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: AnswerBlock[] = [];
  for (const item of raw) {
    const parsed = AnswerBlockSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
    if (out.length >= MAX_BLOCKS) break;
  }
  return out;
}

/** Every chunk id a block cites, in order, without repeats. */
export function blockCitations(blocks: readonly AnswerBlock[]): string[] {
  const ids: string[] = [];
  const add = (list: readonly string[]) => list.forEach((id) => !ids.includes(id) && ids.push(id));
  for (const block of blocks) {
    if (block.type === "range" || block.type === "warning") add(block.cite);
    else for (const item of block.items) add(item.cite);
  }
  return ids;
}
