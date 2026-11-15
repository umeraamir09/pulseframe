/**
 * BM25 retrieval over the research pack (issue 30, step 4). No dependency.
 *
 * The index is built once per cold start (module scope) from
 * src/knowledge/pack.json. Each request only tokenizes the question and
 * scores the chunks.
 *
 * Score = BM25(question, text + topic + keys) + boosts:
 *   - PROTOCOL_BOOST when chunk.topic is the case protocolId,
 *   - REGION_BOOST when the chunk's topic lists one of the case regionIds
 *     (taken from the "regions:" lines the pack has on cond:/proto: chunks)
 *     or the chunk text names the region,
 *   - KEY_BOOST per measurement key named in the question that the chunk carries in keys[].
 * Chunks with score 0 are never returned.
 *
 * Budget policy: chunks are taken in rank order. A chunk that does not fit the
 * remaining budget is skipped and smaller lower-ranked chunks are still tried
 * (skip-and-continue). Pack chunks are at most ~130 tokens, so this only
 * changes the tail, and it fills the budget instead of stopping one chunk short.
 * The budget is a hard cap: usedTokens never exceeds budgetTokens.
 */
import { KEY_LABELS, MEASUREMENT_KEYS, type MeasurementKey } from "../../src/contracts/keys.ts";
import packJson from "../../src/knowledge/pack.json" with { type: "json" };

export interface KnowledgeChunk {
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

export interface RetrieveQuery {
  question: string;
  protocolId?: string;
  regionIds?: readonly string[];
  /** Defaults to DEFAULT_BUDGET_TOKENS. */
  budgetTokens?: number;
}

export interface RetrievedChunk {
  chunk: KnowledgeChunk;
  score: number;
  /** Estimated tokens of formatChunkLine(chunk). */
  tokens: number;
}

export interface RetrieveResult {
  /** In rank order (score desc, then pack order). */
  chunks: RetrievedChunk[];
  /** Ids of the selected chunks. Citations outside this set must be dropped. */
  ids: Set<string>;
  usedTokens: number;
  budgetTokens: number;
  /** Measurement keys detected in the question. */
  keys: MeasurementKey[];
}

export const DEFAULT_BUDGET_TOKENS = 1500;
export const PROTOCOL_BOOST = 4;
export const REGION_BOOST = 1;
export const KEY_BOOST = 3;
const BM25_K1 = 1.2;
const BM25_B = 0.75;

/** Chars ÷ 4, the estimate issue 30 uses for the context budget. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** The line the prompt builder puts in CONTEXT for a chunk. The budget is counted on this. */
export function formatChunkLine(chunk: KnowledgeChunk): string {
  return `[${chunk.id}] ${chunk.text}`;
}

const STOPWORDS = new Set(
  (
    "a an the and or but of to in on at for from by with as is are was were be been being it its this that these those " +
    "what which who whom how when where why do does did can could should would will may might i me my we our you your " +
    "he she they them their there here if then than so not no yes into about over under up down out any all some"
  ).split(" "),
);

/**
 * Lowercase words of letters and digits. A hyphenated word also yields its
 * joined form ("in-flight" -> in, flight, inflight) so it matches "inflight".
 * Stopwords are dropped. No stemming.
 */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const word of text.toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? []) {
    const parts = word.split("-");
    for (const part of parts) if (!STOPWORDS.has(part)) out.push(part);
    if (parts.length > 1) out.push(parts.join(""));
  }
  return out;
}

/** "heartRate" -> ["heartrate", "heart", "rate"]. */
function keyTokens(key: string): string[] {
  const split = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().split(" ");
  return [key.toLowerCase(), ...(split.length > 1 ? split : [])];
}

/** Phrases that name each measurement key in a question, beyond the key and its label. */
const KEY_ALIASES: Record<MeasurementKey, string[]> = {
  heartRate: ["pulse", "hr", "bpm"],
  systolicBP: ["systolic", "blood pressure", "bp"],
  diastolicBP: ["diastolic", "blood pressure", "bp"],
  temperatureC: ["temperature", "fever", "body temp"],
  bloodGlucose: ["glucose", "blood sugar"],
  sleepHours: ["sleep hours", "hours of sleep"],
  moodScore: ["mood"],
  stressScore: ["stress"],
  teamStrain: ["team strain", "crew strain"],
  sleepQuality: ["sleep quality"],
  oxygenSat: ["oxygen saturation", "spo2", "o2 sat", "sats"],
  painScore: ["pain score", "pain"],
  radiationRate: ["radiation", "dose rate"],
};

const KEY_PATTERNS: Array<[MeasurementKey, RegExp]> = MEASUREMENT_KEYS.map((key) => {
  const phrases = [key, KEY_LABELS[key], ...KEY_ALIASES[key]].map((p) =>
    p.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s-]+"),
  );
  return [key, new RegExp(`(^|[^a-z0-9])(${phrases.join("|")})(?![a-z0-9])`)];
});

/** Measurement keys the question names, in MEASUREMENT_KEYS order. */
export function detectKeys(question: string): MeasurementKey[] {
  const text = question.toLowerCase();
  return KEY_PATTERNS.filter(([, re]) => re.test(text)).map(([key]) => key);
}

interface IndexedChunk {
  chunk: KnowledgeChunk;
  order: number;
  tf: Map<string, number>;
  length: number;
  tokens: number;
  textRegions: Set<string>;
}

export interface Retriever {
  retrieve(query: RetrieveQuery): RetrieveResult;
  readonly size: number;
}

const REGION_LINE = /^regions:\s*(.+)$/im;

/** Build an index. Exported for tests; handlers use the module-level `retrieve`. */
export function createRetriever(pack: readonly KnowledgeChunk[]): Retriever {
  const docs: IndexedChunk[] = [];
  const df = new Map<string, number>();
  const topicRegions = new Map<string, Set<string>>();
  let totalLength = 0;

  pack.forEach((chunk, order) => {
    const terms = [...tokenize(chunk.text), ...tokenize(chunk.topic), ...chunk.keys.flatMap(keyTokens)];
    const tf = new Map<string, number>();
    for (const term of terms) tf.set(term, (tf.get(term) ?? 0) + 1);
    for (const term of tf.keys()) df.set(term, (df.get(term) ?? 0) + 1);
    totalLength += terms.length;

    const textRegions = new Set<string>();
    const regionLine = REGION_LINE.exec(chunk.text)?.[1];
    if (regionLine) {
      const regions = topicRegions.get(chunk.topic) ?? new Set<string>();
      for (const region of regionLine.split(/[|;,]/)) {
        const id = region.trim().toLowerCase();
        if (id) {
          regions.add(id);
          textRegions.add(id);
        }
      }
      topicRegions.set(chunk.topic, regions);
    }

    docs.push({ chunk, order, tf, length: terms.length, tokens: estimateTokens(formatChunkLine(chunk)), textRegions });
  });

  const avgLength = docs.length ? totalLength / docs.length : 0;
  const idf = (term: string) => {
    const n = df.get(term) ?? 0;
    return Math.log(1 + (docs.length - n + 0.5) / (n + 0.5));
  };

  function retrieve(query: RetrieveQuery): RetrieveResult {
    const budgetTokens = Math.max(0, query.budgetTokens ?? DEFAULT_BUDGET_TOKENS);
    const queryTerms = [...new Set(tokenize(query.question))];
    const termIdf = queryTerms.map((term) => [term, idf(term)] as const);
    const keys = detectKeys(query.question);
    const regions = (query.regionIds ?? []).map((r) => r.toLowerCase());

    const scored: Array<{ doc: IndexedChunk; score: number }> = [];
    for (const doc of docs) {
      let score = 0;
      for (const [term, weight] of termIdf) {
        const f = doc.tf.get(term);
        if (!f) continue;
        score += (weight * f * (BM25_K1 + 1)) / (f + BM25_K1 * (1 - BM25_B + (BM25_B * doc.length) / avgLength));
      }
      if (query.protocolId && doc.chunk.topic === query.protocolId) score += PROTOCOL_BOOST;
      if (regions.length) {
        const topicSet = topicRegions.get(doc.chunk.topic);
        if (regions.some((r) => doc.textRegions.has(r) || topicSet?.has(r))) score += REGION_BOOST;
      }
      for (const key of keys) if (doc.chunk.keys.includes(key)) score += KEY_BOOST;
      if (score > 0) scored.push({ doc, score });
    }
    scored.sort((a, b) => b.score - a.score || a.doc.order - b.doc.order);

    const chunks: RetrievedChunk[] = [];
    let usedTokens = 0;
    for (const { doc, score } of scored) {
      if (usedTokens + doc.tokens > budgetTokens) continue;
      chunks.push({ chunk: doc.chunk, score, tokens: doc.tokens });
      usedTokens += doc.tokens;
    }
    return { chunks, ids: new Set(chunks.map((c) => c.chunk.id)), usedTokens, budgetTokens, keys };
  }

  return { retrieve, size: docs.length };
}

/** The pack index, built once per cold start. */
export const PACK: readonly KnowledgeChunk[] = packJson as KnowledgeChunk[];
const packRetriever = createRetriever(PACK);

export function retrieve(query: RetrieveQuery): RetrieveResult {
  return packRetriever.retrieve(query);
}
