/**
 * Compiles research/ into a small, cited knowledge pack for the assistant (issue #30).
 *
 *   npm run knowledge   →   src/knowledge/pack.json, src/knowledge/sources.json
 *
 * Each chunk is a short block of facts (≤ MAX_CHUNK_CHARS, about 120 tokens) with
 * `cite` ids that resolve in sources.json. The model only ever sees chunk ids;
 * the client turns cite ids into links. Output is deterministic: same research in,
 * same bytes out. Run it after any change under research/.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const MAX_CHUNK_CHARS = 480;

export interface Source {
  url: string | null;
  title: string;
  section?: string;
  accessed?: string;
  conf?: string;
}

export interface Chunk {
  id: string;
  kind: string;
  topic: string;
  keys: string[];
  text: string;
  cite: string[];
  conf?: string;
  env?: string;
  safety?: boolean;
}

export interface Knowledge {
  chunks: Chunk[];
  sources: Record<string, Source>;
}

type Row = Record<string, string>;
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

// ---------- parsing helpers ----------

/** RFC 4180 CSV: quoted fields may hold commas, quotes ("") and newlines. */
export function parseCsv(input: string): Row[] {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let quoted = false;
  const text = input.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      record.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else field += ch;
  }
  if (field || record.length) {
    record.push(field);
    records.push(record);
  }
  const [header, ...rows] = records.filter((r) => r.some((cell) => cell.trim()));
  if (!header) return [];
  return rows.map((cells) => Object.fromEntries(header.map((name, i) => [name.trim(), (cells[i] ?? "").trim()])));
}

/** Python literal repr (psych-tools.json stores its values this way). */
export function parsePyLiteral(input: string): Json {
  let i = 0;
  const ws = () => {
    while (i < input.length && /\s/.test(input[i]!)) i++;
  };
  const value = (): Json => {
    ws();
    const ch = input[i];
    if (ch === "[" || ch === "(") {
      const close = ch === "[" ? "]" : ")";
      i++;
      const out: Json[] = [];
      for (;;) {
        ws();
        if (input[i] === close) {
          i++;
          return out;
        }
        out.push(value());
        ws();
        if (input[i] === ",") i++;
      }
    }
    if (ch === "{") {
      i++;
      const out: JsonObject = {};
      for (;;) {
        ws();
        if (input[i] === "}") {
          i++;
          return out;
        }
        const key = String(value());
        ws();
        if (input[i++] !== ":") throw new Error(`py literal: expected ':' at ${i}`);
        out[key] = value();
        ws();
        if (input[i] === ",") i++;
      }
    }
    if (ch === "'" || ch === '"') {
      i++;
      let s = "";
      while (input[i] !== ch) {
        if (i >= input.length) throw new Error("py literal: unterminated string");
        if (input[i] === "\\") {
          const next = input[i + 1]!;
          s += next === "n" ? "\n" : next === "t" ? "\t" : next;
          i += 2;
        } else s += input[i++];
      }
      i++;
      return s;
    }
    const word = /^(True|False|None|-?\d+(?:\.\d+)?(?:e-?\d+)?)/.exec(input.slice(i));
    if (!word) throw new Error(`py literal: unexpected '${ch}' at ${i}`);
    i += word[0].length;
    if (word[0] === "True") return true;
    if (word[0] === "False") return false;
    if (word[0] === "None") return null;
    return Number(word[0]);
  };
  const out = value();
  ws();
  if (i !== input.length) throw new Error(`py literal: trailing text at ${i}`);
  return out;
}

// ---------- text helpers ----------

const EMPTY = new Set(["", "n/a", "na", "none", "null", "-"]);

function clean(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1")
    .replace(/\*\*|__|`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isEmpty(value: string): boolean {
  const v = value.trim().toLowerCase();
  return EMPTY.has(v) || v.startsWith("n/a (");
}

function label(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase();
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 33)
    .replace(/-[^-]*$|-$/, (tail) => (tail.length > 1 && text.length > 33 ? "" : tail.replace(/-$/, "")));
}

/** Splits an over-long line at sentence ends, then at word boundaries. */
function splitLong(line: string, max: number): string[] {
  if (line.length <= max) return [line];
  const parts: string[] = [];
  let current = "";
  for (const sentence of line.split(/(?<=[.;!?])\s+/)) {
    const pieces = sentence.length <= max ? [sentence] : sentence.match(new RegExp(`.{1,${max - 1}}(\\s|$)`, "g")) ?? [];
    for (const piece of pieces.map((p) => p.trim())) {
      if (current && current.length + 1 + piece.length > max) {
        parts.push(current);
        current = piece;
      } else current = current ? `${current} ${piece}` : piece;
    }
  }
  if (current) parts.push(current);
  return parts;
}

// ---------- builder ----------

interface SourceInput {
  url?: string;
  title?: string;
  section?: string;
  accessed?: string;
  conf?: string;
}

interface ChunkMeta {
  kind: string;
  topic: string;
  keys?: string[];
  cite: string[];
  conf?: string;
  env?: string;
  safety?: boolean;
}

class Builder {
  chunks: Chunk[] = [];
  sources: Record<string, Source> = {};
  private ids = new Set<string>();

  source(input: SourceInput): string | undefined {
    const url = input.url && /^https?:\/\//.test(input.url.trim()) ? input.url.trim() : null;
    const title = clean(input.title ?? "") || (url ? new URL(url).hostname : "");
    if (!url && !title) return undefined;
    const src: Source = { url, title };
    const section = clean(input.section ?? "");
    if (section && !isEmpty(section) && section !== "NOT FOUND") src.section = section;
    if (input.accessed && !isEmpty(input.accessed)) src.accessed = input.accessed.trim();
    if (input.conf && !isEmpty(input.conf)) src.conf = input.conf.trim();
    const key = JSON.stringify(src);
    for (let n = 6; ; n++) {
      const id = `S${createHash("sha1").update(key).digest("hex").slice(0, n)}`;
      const existing = this.sources[id];
      if (!existing) {
        this.sources[id] = src;
        return id;
      }
      if (JSON.stringify(existing) === key) return id;
    }
  }

  /** A research file as its own source, for rows with no external source. */
  fileSource(file: string, where?: string): string {
    return this.source({ title: `Pulseframe research: ${file}`, section: where })!;
  }

  /** Packs `lines` under `title` into as many chunks as the budget needs. */
  add(idBase: string, title: string, lines: string[], meta: ChunkMeta): void {
    const head = clean(title);
    const budget = MAX_CHUNK_CHARS - head.length - 1;
    const cited = [...meta.cite];
    const stripped = lines.map((line) =>
      clean(line).replace(/,?\s*(https?:\/\/[^\s,;)]+)/g, (_, url: string) => {
        const id = this.source({ url: url.replace(/[.]$/, "") });
        if (id) cited.push(id);
        return "";
      }),
    );
    const body = stripped.filter((l) => l && !isEmpty(l)).flatMap((l) => splitLong(l, budget));
    if (!body.length) return;
    const groups: string[][] = [[]];
    let size = 0;
    for (const line of body) {
      if (size && size + 1 + line.length > budget) {
        groups.push([]);
        size = 0;
      }
      groups[groups.length - 1]!.push(line);
      size += (size ? 1 : 0) + line.length;
    }
    const external = cited.filter((id) => this.sources[id]?.url);
    const cite = [...new Set(external.length ? external : cited)];
    let base = idBase;
    for (let k = 2; this.ids.has(base); k++) base = `${idBase}-${k}`;
    groups.forEach((group, n) => {
      const id = n === 0 ? base : `${base}.${n + 1}`;
      this.ids.add(id);
      const chunk: Chunk = {
        id,
        kind: meta.kind,
        topic: meta.topic,
        keys: [...new Set(meta.keys ?? [])],
        text: [head, ...group].join("\n"),
        cite,
      };
      if (meta.conf && !isEmpty(meta.conf)) chunk.conf = meta.conf;
      if (meta.env && !isEmpty(meta.env)) chunk.env = meta.env;
      if (meta.safety !== undefined) chunk.safety = meta.safety;
      this.chunks.push(chunk);
    });
  }
}

const isTrue = (v: unknown) => v === true || String(v).toLowerCase() === "true";

// ---------- CSV files ----------

/** Columns that describe the source, not the fact. They feed `sources.json`. */
const CSV_META = /(^|_)(url|title|section|page|accessed|date_accessed|confidence|environment|safety)$/;

interface CsvSpec {
  file: string;
  kind: string;
  /** Short id prefix for chunks. */
  prefix: string;
  title: (r: Row) => string;
  /** Chunk id after the prefix. */
  idOf: (r: Row) => string;
  /** Columns already used in the title. */
  titleCols: string[];
  topic: (r: Row) => string;
  keys?: (r: Row) => string[];
  /** Extra sources in the row itself: [urlCol, titleCol, sectionCol, confCol]. */
  inlineSources?: [string, string?, string?, string?][];
  provenance?: string;
}

const CSV_SPECS: CsvSpec[] = [
  {
    file: "conditions.csv",
    kind: "condition",
    prefix: "cond",
    idOf: (r) => r.conditionId!,
    title: (r) => `Condition: ${r.name} (${r.conditionId})`,
    titleCols: ["name", "conditionId"],
    topic: (r) => r.conditionId!,
    inlineSources: [
      ["source_url", "source_title", "source_section", "confidence"],
      ["severity_basis_url", undefined, "severity_basis_section", "severity_basis_confidence"],
      ["red_flags_source_url", "red_flags_source_title", "red_flags_section", "red_flags_confidence"],
    ],
  },
  {
    file: "condition-vitals.csv",
    kind: "condition-vital",
    prefix: "cv",
    idOf: (r) => `${r.conditionId}:${r.measurementKey}`,
    title: (r) => `${r.measurementKey} in ${r.conditionId}`,
    titleCols: ["measurementKey", "conditionId"],
    topic: (r) => r.conditionId!,
    keys: (r) => [r.measurementKey!],
    provenance: "condition-vitals.provenance.csv",
  },
  {
    file: "baselines-inflight.csv",
    kind: "baseline",
    prefix: "base",
    idOf: (r) => r.measurementKey!,
    title: (r) => `Baseline for ${r.measurementKey}`,
    titleCols: ["measurementKey"],
    topic: () => "baseline",
    keys: (r) => [r.measurementKey!],
    provenance: "baselines-inflight.provenance.csv",
  },
  {
    file: "new-measurement-keys.csv",
    kind: "measurement-key",
    prefix: "key",
    idOf: (r) => r.key!,
    title: (r) => `Measurement ${r.key}: ${r.name}`,
    titleCols: ["key", "name"],
    topic: () => "measurement",
    keys: (r) => [r.key!],
    inlineSources: [["source_url", "source_title", "source_page", "confidence"]],
  },
  {
    file: "daily-routine.csv",
    kind: "routine",
    prefix: "routine",
    idOf: (r) => r.item!,
    title: (r) => `Routine: ${r.item}`,
    titleCols: ["item"],
    topic: () => "routine",
    keys: (r) => (r.linkedKey ? [r.linkedKey] : []),
    provenance: "daily-routine.provenance.csv",
  },
  {
    file: "spaceflight-factors.csv",
    kind: "spaceflight-factor",
    prefix: "factor",
    idOf: (r) => r.factor!,
    title: (r) => `Spaceflight factor: ${r.factor}`,
    titleCols: ["factor"],
    topic: (r) => r.hazardId || "spaceflight",
    provenance: "spaceflight-factors.provenance.csv",
  },
  {
    file: "radiation.csv",
    kind: "radiation",
    prefix: "rad",
    idOf: (r) => r.quantity!,
    title: (r) => `Radiation: ${r.quantity}`,
    titleCols: ["quantity"],
    topic: () => "radiation",
    provenance: "radiation.provenance.csv",
  },
  {
    file: "comms.csv",
    kind: "comms",
    prefix: "comms",
    idOf: (r) => r.link!,
    title: (r) => `Comms: ${r.link}`,
    titleCols: ["link"],
    topic: () => "comms",
    provenance: "comms.provenance.csv",
  },
];

function buildCsv(b: Builder, dir: string, spec: CsvSpec): void {
  const rows = parseCsv(readFileSync(join(dir, spec.file), "utf8"));
  const prov = new Map<number, Row>();
  if (spec.provenance) {
    for (const p of parseCsv(readFileSync(join(dir, spec.provenance), "utf8"))) prov.set(Number(p.csv_row), p);
  }
  rows.forEach((r, index) => {
    const csvRow = index + 2; // header is row 1
    const p = prov.get(csvRow);
    const cite: string[] = [];
    if (p) {
      const id = b.source({
        url: p.source_url,
        title: p.document_title,
        section: p.page_or_section,
        accessed: p.date_accessed,
        conf: r.confidence,
      });
      if (id) cite.push(id);
    } else if (r.source_url) {
      const id = b.source({ url: r.source_url, conf: r.confidence, accessed: r.date_accessed || r.accessed });
      if (id && !spec.inlineSources) cite.push(id);
    }
    for (const [urlCol, titleCol, sectionCol, confCol] of spec.inlineSources ?? []) {
      const id = b.source({
        url: r[urlCol],
        title: titleCol ? r[titleCol] : undefined,
        section: sectionCol ? r[sectionCol] : undefined,
        accessed: r.date_accessed || r.accessed,
        conf: confCol ? r[confCol] : undefined,
      });
      if (id && r[urlCol] && /^https?:/.test(r[urlCol]!)) cite.push(id);
    }
    if (!cite.length) cite.push(b.fileSource(spec.file, `row ${csvRow}`));

    const lines = Object.entries(r)
      .filter(([col]) => !spec.titleCols.includes(col) && !CSV_META.test(col))
      .map(([col, v]) => `${label(col)}: ${v}`)
      .filter((line) => !isEmpty(line.slice(line.indexOf(":") + 1)));
    if (p?.notes) lines.push(`researcher note: ${p.notes}`);

    const env = r.environment || p?.environment;
    const safety = r.safety || p?.safety;
    b.add(`${spec.prefix}:${spec.idOf(r).split(":").map(slug).join(":")}`, spec.title(r), lines, {
      kind: spec.kind,
      topic: spec.topic(r),
      keys: spec.keys?.(r).filter(Boolean),
      cite,
      conf: r.confidence,
      env,
      safety: safety ? isTrue(safety) : undefined,
    });
  });
}

// ---------- JSON files ----------

const URL_KEY = /^(.*?)(_?source_?url|_?url)$/i;
/** Keys that describe a source or bookkeeping, not a fact for the crew. */
const JSON_META = new Set([
  "id",
  "sourceUrl",
  "source_url",
  "url",
  "sourceTitle",
  "document_title",
  "title_of_source",
  "sourcePage",
  "page_or_section",
  "accessed",
  "date_accessed",
  "confidence",
  "environment",
  "safety",
  "requestedBy",
  "provenance",
  "labeledDoseText", // the app never shows a dose (decisions.md §1)
]);

/** Pulls every url-bearing object in `node` into the source registry. */
function collectSources(b: Builder, node: Json, out: string[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collectSources(b, item, out);
    return;
  }
  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    const m = URL_KEY.exec(key);
    if (m && typeof value === "string" && /^https?:\/\//.test(value)) {
      const prefix = m[1] ? m[1].replace(/_$/, "") : "";
      const pick = (...names: string[]) => names.map((n) => node[n]).find((v) => typeof v === "string") as string | undefined;
      const id = b.source(
        prefix
          ? { url: value, title: pick(`${prefix}_title`, `${prefix}Title`), accessed: pick("date_accessed", "accessed") }
          : {
              url: value,
              title: pick("sourceTitle", "document_title", "title", "source_title"),
              section: pick("sourcePage", "page_or_section", "section", "source_page"),
              accessed: pick("accessed", "date_accessed"),
              conf: pick("confidence"),
            },
      );
      if (id) out.push(id);
    } else if (value && typeof value === "object") collectSources(b, value, out);
  }
}

function formatValue(value: Json): string {
  if (value === null) return "";
  if (Array.isArray(value)) return value.map(formatValue).filter((v) => v && !isEmpty(v)).join("; ");
  if (typeof value === "object") {
    return Object.entries(value)
      .filter(([k]) => !JSON_META.has(k) && !URL_KEY.test(k))
      .map(([k, v]) => {
        const text = formatValue(v);
        return text && !isEmpty(text) ? `${label(k)}: ${text}` : "";
      })
      .filter(Boolean)
      .join(", ");
  }
  return String(value);
}

function objectLines(obj: JsonObject, skip: string[] = []): string[] {
  return Object.entries(obj)
    .filter(([k]) => !JSON_META.has(k) && !skip.includes(k) && !URL_KEY.test(k) && !/_title$|Title$/.test(k))
    .map(([k, v]) => {
      const text = formatValue(v);
      return text && !isEmpty(text) ? `${label(k)}: ${text}` : "";
    })
    .filter(Boolean);
}

function readJson(dir: string, file: string): Json {
  return JSON.parse(readFileSync(join(dir, file), "utf8")) as Json;
}

function buildInventory(b: Builder, dir: string): void {
  for (const item of readJson(dir, "inventory.json") as JsonObject[]) {
    const cite: string[] = [];
    collectSources(b, item, cite);
    b.add(`inv:${item.id}`, `Kit item: ${item.name} (id ${item.id})`, objectLines(item, ["name", "quote"]), {
      kind: "inventory",
      topic: "inventory",
      cite: cite.length ? cite : [b.fileSource("inventory.json", String(item.id))],
      conf: item.confidence as string,
      env: item.environment as string,
      safety: item.safety === undefined ? undefined : isTrue(item.safety),
    });
  }
}

function buildEquipment(b: Builder, dir: string): void {
  for (const item of readJson(dir, "equipment.json") as JsonObject[]) {
    const cite: string[] = [];
    collectSources(b, item, cite);
    const measures = Array.isArray(item.measures) ? (item.measures as string[]) : [];
    b.add(`eq:${item.id}`, `Equipment: ${item.name} (id ${item.id})`, objectLines(item, ["name"]), {
      kind: "equipment",
      topic: "equipment",
      keys: measures,
      cite: cite.length ? cite : [b.fileSource("equipment.json", String(item.id))],
      conf: item.confidence as string,
      env: item.environment as string,
      safety: item.safety === undefined ? undefined : isTrue(item.safety),
    });
  }
}

function buildPsych(b: Builder, dir: string): void {
  const raw = readJson(dir, "psych-tools.json") as Record<string, string>;
  const parsed: Record<string, Json> = {};
  for (const [k, v] of Object.entries(raw)) parsed[k] = typeof v === "string" ? parsePyLiteral(v) : v;

  const add = (id: string, title: string, obj: JsonObject | Json, where: string) => {
    const cite: string[] = [];
    collectSources(b, obj, cite);
    const lines = obj && typeof obj === "object" && !Array.isArray(obj) ? objectLines(obj, ["name"]) : [formatValue(obj)];
    const o = (obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {}) as JsonObject;
    b.add(`psych:${id}`, title, lines, {
      kind: "psych",
      topic: "psych",
      keys: ["moodScore", "stressScore"],
      cite: cite.length ? cite : [b.fileSource("psych-tools.json", where)],
      conf: o.confidence as string,
      env: o.environment as string,
      safety: o.safety === undefined ? undefined : isTrue(o.safety),
    });
  };

  for (const tool of (parsed.tools ?? []) as JsonObject[]) add(String(tool.id), `Psych tool: ${tool.name}`, tool, "tools");
  const levels = (parsed.action_levels ?? {}) as JsonObject;
  for (const level of (levels.levels ?? []) as JsonObject[]) {
    add(`level-${slug(String(level.level))}`, `Psych action level: ${level.level} (${levels.status ?? ""})`, level, "action_levels");
  }
  const emergency = (parsed.behavioral_emergency ?? {}) as JsonObject;
  for (const [key, value] of Object.entries(emergency)) {
    const items = Array.isArray(value) ? value : [value];
    items.forEach((item, n) => add(`emergency-${slug(key)}-${n + 1}`, `Behavioral emergency: ${label(key)}`, item, "behavioral_emergency"));
  }
  if (parsed.not_found) add("not-found", "Psych tools: NOT FOUND in research", parsed.not_found, "not_found");
}

function buildProtocols(b: Builder, dir: string): void {
  const protoDir = join(dir, "protocols");
  for (const file of readdirSync(protoDir).filter((f) => f.endsWith(".json")).sort()) {
    const card = JSON.parse(readFileSync(join(protoDir, file), "utf8")) as JsonObject;
    const id = String(card.id);
    const local = new Map<string, string>();
    for (const s of (card.sources ?? []) as JsonObject[]) {
      const gid = b.source({
        url: s.url as string,
        title: s.title as string,
        section: s.section as string,
        accessed: s.accessed as string,
        conf: s.confidence as string,
      });
      if (gid) local.set(String(s.id), gid);
    }
    const fallback = b.fileSource(`protocols/${file}`);
    const citeOf = (items: Json): string[] => {
      const ids: string[] = [];
      const walk = (n: Json) => {
        if (Array.isArray(n)) n.forEach(walk);
        else if (n && typeof n === "object") {
          for (const sid of (n.sourceIds ?? []) as string[]) if (local.has(sid)) ids.push(local.get(sid)!);
          Object.values(n).forEach(walk);
        }
      };
      walk(items);
      return ids.length ? ids : [fallback];
    };
    const meta = (cite: string[], keys: string[] = []): ChunkMeta => ({
      kind: "protocol",
      topic: id,
      keys,
      cite,
      env: card.environment as string,
      safety: card.safety === undefined ? undefined : isTrue(card.safety),
    });
    const title = `Protocol ${card.title} (card ${id})`;
    const list = (v: Json) => ((Array.isArray(v) ? v : []) as Json[]).map((x) => (typeof x === "string" ? x : formatValue(x)));
    const steps = (v: Json, a: string, c: string) =>
      ((Array.isArray(v) ? v : []) as JsonObject[]).map((x, n) => `${n + 1}. ${x[a]}: ${x[c]}`);

    b.add(`proto:${id}`, `${title}: overview`, [
      `regions: ${formatValue(card.regionIds ?? [])}`,
      `cautions: ${card.cautions}`,
      `kit items: ${formatValue(card.candidateItemIds ?? []) || "none"}. ${card.candidateItemNotes ?? ""}`,
      `equipment: ${formatValue(card.equipmentIds ?? [])}`,
      `status: ${card.sourceNote}`,
    ], meta([fallback]));
    b.add(`proto:${id}:red`, `${title}: red flags`, [
      `life threat, act now: ${list(card.redFlagsLifeThreat).join("; ")}`,
      `call the ground: ${list(card.redFlagsCallGround).join("; ")}`,
    ], meta(citeOf([card.redFlagsLifeThreat ?? [], card.redFlagsCallGround ?? []])));
    b.add(`proto:${id}:diff`, `${title}: working ideas (not a diagnosis)`,
      ((card.differential ?? []) as JsonObject[]).map((d) => `${d.label}: ${d.note}`), meta(citeOf(card.differential ?? [])));
    const tests = (card.tests ?? []) as JsonObject[];
    b.add(`proto:${id}:tests`, `${title}: tests`, steps(tests, "title", "instruction"),
      meta(citeOf(tests), tests.map((t) => t.inputKey as string).filter(Boolean)));
    b.add(`proto:${id}:steps`, `${title}: immediate steps`, steps(card.immediateSteps ?? [], "title", "instruction"),
      meta(citeOf(card.immediateSteps ?? [])));
    b.add(`proto:${id}:time`, `${title}: time limits`, list(card.timeLimits).map((t) => t.replace(/^item: /, "")),
      meta(citeOf(card.timeLimits ?? [])));
    if (card.whenGroundUnavailable) {
      b.add(`proto:${id}:los`, `${title}: when the ground is unreachable`, objectLines(card.whenGroundUnavailable as JsonObject),
        meta(citeOf(card.whenGroundUnavailable)));
    }
    b.add(`proto:${id}:gaps`, `${title}: gaps (NOT FOUND)`, list(card.gaps), meta([fallback]));
  }
}

// ---------- Markdown files ----------

const MD_SPECS: { file: string; kind: string; prefix: string }[] = [
  { file: "decisions.md", kind: "decision", prefix: "dec" },
  { file: "baseline-method.md", kind: "method-note", prefix: "method" },
  { file: "condition-vitals-notes.md", kind: "gap-note", prefix: "cvnote" },
  { file: "batch1-gaps.md", kind: "gap-note", prefix: "gaps" },
];

function tableCells(line: string): string[] {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
}

function inlineSources(b: Builder, text: string): string[] {
  const ids: string[] = [];
  for (const m of text.matchAll(/\bPMID[:\s]*(\d{6,9})/g)) {
    ids.push(b.source({ url: `https://pubmed.ncbi.nlm.nih.gov/${m[1]}/`, title: `PubMed ${m[1]}` })!);
  }
  for (const m of text.matchAll(/\b(PMC\d{5,9})\b/g)) {
    ids.push(b.source({ url: `https://pmc.ncbi.nlm.nih.gov/articles/${m[1]}/`, title: m[1] })!);
  }
  for (const m of text.matchAll(/\[([^\]]+)\]\((https?:[^)]+)\)/g)) ids.push(b.source({ url: m[2], title: m[1] })!);
  return ids;
}

function buildMarkdown(b: Builder, dir: string, spec: { file: string; kind: string; prefix: string }): void {
  const lines = readFileSync(join(dir, spec.file), "utf8").split(/\r?\n/);

  // Pass 1: reference tables (| ref | source | section | quote | confidence |).
  const refs = new Map<string, string>();
  let refTable = false;
  for (const line of lines) {
    if (!line.trim().startsWith("|")) {
      refTable = false;
      continue;
    }
    const cells = tableCells(line);
    if (cells[0]?.toLowerCase() === "ref") {
      refTable = true;
      continue;
    }
    if (!refTable || /^-+$/.test(cells[0] ?? "")) continue;
    const link = /\[([^\]]+)\]\((https?:[^)]+)\)/.exec(cells[1] ?? "");
    const id = b.source({ url: link?.[2], title: link?.[1] ?? cells[1], section: cells[2], conf: cells[4] });
    if (id) refs.set(cells[0]!, id);
  }

  // Pass 2: sections.
  const docTitle = clean((lines.find((l) => l.startsWith("# ")) ?? spec.file).replace(/^#\s*/, ""));
  let h2 = "";
  let h3 = "";
  let blocks: string[] = [];
  let header: string[] | null = null;
  refTable = false;
  const flush = () => {
    const text = blocks.join(" ");
    const cite = [...[...text.matchAll(/\[([a-z]\d+[a-z]*)\]/g)].map((m) => refs.get(m[1]!)).filter((x): x is string => !!x), ...inlineSources(b, text)];
    const out = blocks.map((l) => l.replace(/\s*\[[a-z]\d+[a-z]*\](,\s*\[[a-z]\d+[a-z]*\])*/g, ""));
    const where = [h2, h3].filter(Boolean).join(" › ");
    b.add(`${spec.prefix}:${slug(h2 || "intro")}${h3 ? `:${slug(h3)}` : ""}`, `${docTitle}${where ? ` › ${where}` : ""}`, out, {
      kind: spec.kind,
      topic: spec.kind,
      cite: cite.length ? cite : [b.fileSource(spec.file, where || undefined)],
    });
    blocks = [];
  };
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("# ")) continue;
    if (t.startsWith("## ") || t.startsWith("### ")) {
      flush();
      if (t.startsWith("## ")) {
        h2 = clean(t.slice(3));
        h3 = "";
      } else h3 = clean(t.slice(4));
      continue;
    }
    if (t.startsWith("|")) {
      const cells = tableCells(t);
      if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
      if (!header) {
        header = cells;
        refTable = cells[0]?.toLowerCase() === "ref";
        continue;
      }
      if (!refTable) blocks.push(cells.map((c, i) => (header![i] ? `${header![i]}: ${c}` : c)).join("; "));
      continue;
    }
    header = null;
    refTable = false;
    if (!t) continue;
    blocks.push(t.replace(/^[-*]\s+|^\d+\.\s+/, ""));
  }
  flush();
}

// ---------- entry points ----------

export function buildKnowledge(researchDir: string): Knowledge {
  const b = new Builder();
  for (const spec of CSV_SPECS) buildCsv(b, researchDir, spec);
  buildProtocols(b, researchDir);
  buildInventory(b, researchDir);
  buildEquipment(b, researchDir);
  buildPsych(b, researchDir);
  for (const spec of MD_SPECS) buildMarkdown(b, researchDir, spec);

  // Tag chunks with every known measurement key their text names.
  const known = new Set(b.chunks.flatMap((c) => c.keys));
  for (const chunk of b.chunks) {
    for (const key of known) if (!chunk.keys.includes(key) && new RegExp(`\\b${key}\\b`).test(chunk.text)) chunk.keys.push(key);
    chunk.keys.sort();
  }

  // Keep only sources that a chunk cites, sorted for stable output.
  const used = new Set(b.chunks.flatMap((c) => c.cite));
  const sources = Object.fromEntries(Object.entries(b.sources).filter(([id]) => used.has(id)).sort(([a], [z]) => a.localeCompare(z)));
  return { chunks: b.chunks, sources };
}

/** One chunk per line keeps diffs reviewable. */
export function serializeChunks(chunks: Chunk[]): string {
  return `[\n${chunks.map((c) => JSON.stringify(c)).join(",\n")}\n]\n`;
}

export function serializeSources(sources: Record<string, Source>): string {
  return `{\n${Object.entries(sources).map(([id, s]) => `${JSON.stringify(id)}: ${JSON.stringify(s)}`).join(",\n")}\n}\n`;
}

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const RESEARCH_DIR = join(ROOT, "research");
export const OUT_DIR = join(ROOT, "src", "knowledge");

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { chunks, sources } = buildKnowledge(RESEARCH_DIR);
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "pack.json"), serializeChunks(chunks));
  writeFileSync(join(OUT_DIR, "sources.json"), serializeSources(sources));
  const chars = chunks.reduce((n, c) => n + c.text.length, 0);
  const counts = new Map<string, number>();
  for (const c of chunks) counts.set(c.kind, (counts.get(c.kind) ?? 0) + 1);
  const kinds = [...counts].map(([k, n]) => `${k} ${n}`);
  console.log(`${basename(OUT_DIR)}: ${chunks.length} chunks, ${Object.keys(sources).length} sources, ~${Math.round(chars / 4)} tokens total`);
  console.log(`  ${kinds.join(", ")}`);
}
