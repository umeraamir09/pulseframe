/**
 * Vite plugin: serves `virtual:citation-index`, a small chunkId → source map for
 * the assistant's citation chips (issue 30, step 6).
 *
 * The full `src/knowledge/pack.json` (~430 KB) holds chunk text the client never
 * shows. The chips only need each chunk's `cite` ids and each source's
 * url/title/section, so the build keeps just those (~23 KB gzipped), and the
 * page loads it lazily on the first cited reply.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";

export const CITATION_INDEX_ID = "virtual:citation-index";
const RESOLVED_ID = `\0${CITATION_INDEX_ID}`;

export interface CitationIndex {
  /** chunk id → source ids, in pack order. */
  chunks: Record<string, string[]>;
  /** source id → [url, title, section]; only cited sources that have a url. */
  sources: Record<string, [string, string, string]>;
}

interface PackChunk {
  id: string;
  cite: string[];
}

interface SourceRow {
  url: string | null;
  title: string;
  section?: string;
}

export function buildCitationIndex(pack: PackChunk[], sources: Record<string, SourceRow>): CitationIndex {
  const chunks: CitationIndex["chunks"] = {};
  const used: CitationIndex["sources"] = {};
  for (const chunk of pack) {
    chunks[chunk.id] = [...chunk.cite];
    for (const id of chunk.cite) {
      const row = sources[id];
      // "NOT FOUND" research rows have no url; they are not linkable sources.
      if (row && typeof row.url === "string" && row.url && !used[id]) used[id] = [row.url, row.title, row.section ?? ""];
    }
  }
  return { chunks, sources: used };
}

export function citationIndexPlugin(knowledgeDir = resolve(import.meta.dirname, "../src/knowledge")): Plugin {
  const packPath = resolve(knowledgeDir, "pack.json");
  const sourcesPath = resolve(knowledgeDir, "sources.json");
  return {
    name: "pulseframe-citation-index",
    resolveId(id) {
      return id === CITATION_INDEX_ID ? RESOLVED_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_ID) return undefined;
      this.addWatchFile(packPath);
      this.addWatchFile(sourcesPath);
      const pack = JSON.parse(readFileSync(packPath, "utf8")) as PackChunk[];
      const sources = JSON.parse(readFileSync(sourcesPath, "utf8")) as Record<string, SourceRow>;
      const index = buildCitationIndex(pack, sources);
      return `export const chunks = ${JSON.stringify(index.chunks)};\nexport const sources = ${JSON.stringify(index.sources)};\n`;
    },
  };
}
