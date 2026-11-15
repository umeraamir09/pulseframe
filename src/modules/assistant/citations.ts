/**
 * Turns the pack chunk ids a live answer cites into source links (issue 30, step 6).
 *
 * chunk id → chunk.cite (source ids) → sources.json {url, title, section}.
 * The lookup table is `virtual:citation-index` (scripts/citationIndexPlugin.ts),
 * loaded lazily so offline-only sessions never download it.
 */

export interface CitationSource {
  id: string;
  /** 1-based, in order of first citation; the inline markers use these numbers. */
  n: number;
  url: string;
  title: string;
  section: string;
}

export interface ResolvedCitations {
  sources: CitationSource[];
  /** chunk id → source numbers, for rewriting inline `[chunk-id]` markers. */
  byChunk: Record<string, number[]>;
}

export interface CitationTables {
  chunks: Record<string, string[]>;
  sources: Record<string, [string, string, string]>;
}

export const EMPTY_CITATIONS: ResolvedCitations = { sources: [], byChunk: {} };

/** Unknown chunk ids and unresolvable source ids are dropped, never shown as links. */
export function resolveCitations(chunkIds: readonly string[], tables: CitationTables): ResolvedCitations {
  const sources: CitationSource[] = [];
  const numberOf = new Map<string, number>();
  const byChunk: Record<string, number[]> = {};
  for (const chunkId of chunkIds) {
    const numbers: number[] = [];
    for (const sourceId of tables.chunks[chunkId] ?? []) {
      const row = tables.sources[sourceId];
      if (!row) continue;
      let n = numberOf.get(sourceId);
      if (n === undefined) {
        n = sources.length + 1;
        numberOf.set(sourceId, n);
        sources.push({ id: sourceId, n, url: row[0], title: row[1], section: row[2] });
      }
      if (!numbers.includes(n)) numbers.push(n);
    }
    if (numbers.length) byChunk[chunkId] = numbers;
  }
  return { sources, byChunk };
}

export async function loadCitations(chunkIds: readonly string[]): Promise<ResolvedCitations> {
  if (!chunkIds.length) return EMPTY_CITATIONS;
  const tables = await import("virtual:citation-index");
  return resolveCitations(chunkIds, tables);
}

/**
 * Rewrites `[chunk-id]` markers as `[1, 2]` source numbers. Markers for chunks
 * with no resolvable source are removed, so raw ids never reach the crew.
 */
export function numberMarkers(text: string, byChunk: Record<string, number[]>): string {
  return text
    .replace(/\s*\[([a-z0-9][a-z0-9:._-]*)\]/gi, (match, id: string) => {
      const numbers = byChunk[id];
      if (numbers) return ` [${numbers.join(", ")}]`;
      return id.includes(":") ? "" : match;
    })
    .trim();
}
