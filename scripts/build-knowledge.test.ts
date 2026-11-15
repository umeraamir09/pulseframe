import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildKnowledge,
  MAX_CHUNK_CHARS,
  OUT_DIR,
  parseCsv,
  parsePyLiteral,
  RESEARCH_DIR,
  serializeChunks,
  serializeSources,
} from "./build-knowledge.ts";

const built = buildKnowledge(RESEARCH_DIR);

describe("knowledge pack", () => {
  it("matches the committed pack (run npm run knowledge after editing research/)", () => {
    expect(readFileSync(join(OUT_DIR, "pack.json"), "utf8")).toBe(serializeChunks(built.chunks));
    expect(readFileSync(join(OUT_DIR, "sources.json"), "utf8")).toBe(serializeSources(built.sources));
  });

  it("is deterministic", () => {
    const again = buildKnowledge(RESEARCH_DIR);
    expect(serializeChunks(again.chunks)).toBe(serializeChunks(built.chunks));
    expect(serializeSources(again.sources)).toBe(serializeSources(built.sources));
  });

  it("gives every chunk a citation that resolves in sources.json", () => {
    for (const chunk of built.chunks) {
      expect(chunk.cite.length, chunk.id).toBeGreaterThan(0);
      for (const id of chunk.cite) expect(built.sources[id], `${chunk.id} → ${id}`).toBeDefined();
    }
  });

  it("keeps chunks small, unique and free of raw URLs", () => {
    const ids = new Set<string>();
    for (const chunk of built.chunks) {
      expect(chunk.text.length, chunk.id).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
      expect(chunk.text, chunk.id).not.toMatch(/https?:\/\//);
      expect(ids.has(chunk.id), chunk.id).toBe(false);
      ids.add(chunk.id);
    }
  });

  it("covers every research area", () => {
    const kinds = new Set(built.chunks.map((c) => c.kind));
    for (const kind of ["condition", "condition-vital", "baseline", "protocol", "inventory", "equipment", "psych", "decision", "radiation", "comms"]) {
      expect(kinds.has(kind), kind).toBe(true);
    }
    expect(built.chunks.find((c) => c.id === "inv:kit-white-olopatadine")?.text).toContain("Olopatadine");
    expect(built.chunks.find((c) => c.id === "proto:choking-airway:steps")?.text).toContain("immediate steps");
  });

  it("never carries a labeled dose field", () => {
    for (const chunk of built.chunks.filter((c) => c.kind === "inventory")) {
      expect(chunk.text.toLowerCase()).not.toContain("labeled dose text");
    }
  });
});

describe("parsers", () => {
  it("parses quoted CSV fields with commas, quotes and newlines", () => {
    const rows = parseCsv('a,b\n"x, y","say ""hi""\nthere"\n');
    expect(rows).toEqual([{ a: "x, y", b: 'say "hi"\nthere' }]);
  });

  it("parses Python literal reprs", () => {
    expect(parsePyLiteral("[{'a': 'it\\'s', 'b': True, 'c': None, 'd': 1.5}]")).toEqual([
      { a: "it's", b: true, c: null, d: 1.5 },
    ]);
  });
});
