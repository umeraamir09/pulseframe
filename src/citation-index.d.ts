/** Served by scripts/citationIndexPlugin.ts (chunk id → source ids, source id → [url, title, section]). */
declare module "virtual:citation-index" {
  export const chunks: Record<string, string[]>;
  export const sources: Record<string, [string, string, string]>;
}
