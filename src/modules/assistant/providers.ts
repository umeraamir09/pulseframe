import type { InventoryItem, SkeletonRegionId } from "../../contracts";
import { KEY_LABELS } from "../../contracts";
import { explainAlert, missionDayLabel, missionDayOf, SIM_CREW, store } from "../../data/db";
import { getProtocol, matchProtocol } from "../protocols";
import { ANSWER_KINDS, parseBlocks, type AnswerBlock, type AnswerKind } from "./answerBlocks";
import { ASSISTANT_DISCLAIMER, LIVE_FALLBACK_NOTE, NO_ONBOARD_ITEM, NO_OPEN_CASE_REPLY, OFFLINE_COMMANDS_ONLY, PROVENANCE_LABEL } from "./copy";
import { answerLocally } from "./routing";
import type { ReplyAction, ReplyKind } from "./types";

export interface CaseContext {
  caseId: string;
  crewId: string;
  narrative: string;
  regionIds: SkeletonRegionId[];
  protocolId?: string;
}

export interface LastTurn {
  question: string;
  answer: string;
}

export interface AssistantAsk {
  command: string;
  caseCtx?: CaseContext;
  inventory: InventoryItem[];
  /** Previous live Q/A pair; only sent with free-text questions. The server trims it to 200 tokens. */
  lastTurn?: LastTurn;
}

export interface AssistantReply {
  text: string;
  draft?: unknown;
  /** Pack chunk ids (e.g. "cv:headache-co2:heartrate"), live answers only. */
  citations?: string[];
  /** True when the research pack does not cover the question. */
  notFound?: boolean;
  /**
   * "research" (cited), "general" (uncited), "notFound", or a local card:
   * "emergency", "app", or "formulary".
   */
  kind?: AnswerKind | ReplyKind;
  /** Live answers only: visual blocks rendered under the lead text. */
  blocks?: AnswerBlock[];
  title?: string;
  steps?: string[];
  actions?: ReplyAction[];
  redFlag?: string;
  badge?: string;
}

export interface AssistantProvider {
  name: "offline" | "live";
  ask(input: AssistantAsk): Promise<AssistantReply>;
}

export const LIVE_TIMEOUT_MS = 8000;

/** Longest lastTurn field the client sends; the server schema allows 5,000 and trims to 200 tokens. */
export const LAST_TURN_MAX_CHARS = 1000;

function parseCommand(raw: string): { verb: string; arg: string } {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  const space = trimmed.indexOf(" ");
  if (space === -1) return { verb: trimmed.toLowerCase(), arg: "" };
  return { verb: trimmed.slice(0, space).toLowerCase(), arg: trimmed.slice(space + 1).trim() };
}

function describeItem(item: InventoryItem): string {
  return [
    item.name,
    `id: ${item.id}`,
    `Pack: ${item.pack}`,
    `Strength: ${item.strength}`,
    `Route: ${item.route}`,
    `Qty in pack: ${item.quantityOnBoard ?? "not stated"}`,
    `Location: ${item.location || "not stated"}`,
    `Possible side effects: ${item.sideEffects || "not stated"}`,
    `Comments: ${item.comments || "not stated"}`,
    PROVENANCE_LABEL,
    `Source: ${item.sourceUrl} page ${item.sourcePage ?? "not stated"}`,
  ].join("\n");
}

function helpText(): string {
  return [
    "Commands:",
    "suggest: items named on the open case's protocol card, onboard kit only",
    "find <text>: search item name and PDF comments",
    "item <id>: show one onboard item",
    "alerts: list open alerts",
    "help: list these commands",
    "You can also describe a symptom, ask how a page works, or ask a short general question.",
    "Pulseframe does not suggest a dose. A flight surgeon directs anything given.",
    ASSISTANT_DISCLAIMER,
  ].join("\n");
}

function findText(inventory: InventoryItem[], query: string): string {
  if (!query) return "Usage: find <text>";
  const needle = query.toLowerCase();
  const hits = inventory.filter(
    (item) => item.name.toLowerCase().includes(needle) || item.comments.toLowerCase().includes(needle),
  );
  if (!hits.length) return `No onboard item matches "${query}".`;
  return [`${hits.length} match${hits.length === 1 ? "" : "es"} in the onboard kit.`, ...hits.map(describeItem)].join("\n\n");
}

function itemText(inventory: InventoryItem[], id: string): string {
  if (!id) return "Usage: item <id>";
  const item = inventory.find((row) => row.id.toLowerCase() === id.toLowerCase());
  if (!item) return `No onboard item with id "${id}".`;
  return describeItem(item);
}

async function alertsText(crewId: string): Promise<string> {
  const open = (await store.listAlerts(crewId)).filter((alert) => !alert.ackedAt);
  if (!open.length) return "No open alerts.";
  const lines = [`${open.length} open alert${open.length === 1 ? "" : "s"}.`];
  for (const alert of open) {
    lines.push(`${KEY_LABELS[alert.key]} · ${missionDayLabel(missionDayOf(alert.openedAt))}`);
    lines.push(explainAlert(alert));
  }
  return lines.join("\n");
}

function suggest(input: AssistantAsk): AssistantReply {
  if (!input.caseCtx) return { text: NO_OPEN_CASE_REPLY };
  const arg = parseCommand(input.command).arg;
  const byId = input.caseCtx.protocolId ? getProtocol(input.caseCtx.protocolId) : undefined;
  const card = byId ?? matchProtocol(arg || input.caseCtx.narrative, input.caseCtx.regionIds);
  const draft = {
    itemIds: [...card.candidateItemIds],
    rationale: `From protocol card ${card.title}`,
    cautions: card.cautions,
  };
  const lines = [draft.rationale];
  if (card.candidateItemIds.length === 0) lines.push(NO_ONBOARD_ITEM);
  lines.push(card.cautions);
  return { text: lines.join("\n"), draft };
}

export const offlineProvider: AssistantProvider = {
  name: "offline",
  async ask(input) {
    const routed = answerLocally(input.command, input.inventory, {
      caseOpen: Boolean(input.caseCtx),
      fallbackGeneral: true,
    });
    if (routed?.kind === "emergency") return routed;
    const { verb, arg } = parseCommand(input.command);
    if (verb === "help") return { text: helpText() };
    if (verb === "find") return { text: findText(input.inventory, arg) };
    if (verb === "item") return { text: itemText(input.inventory, arg) };
    if (verb === "alerts" || (verb === "explain" && arg.toLowerCase() === "alerts")) {
      return { text: await alertsText(input.caseCtx?.crewId ?? SIM_CREW.id) };
    }
    if (verb === "suggest") return suggest(input);
    if (routed) return routed;
    return { text: `Unknown command "${verb}". ${OFFLINE_COMMANDS_ONLY}` };
  },
};

/** Commands the offline provider answers; these never reach /api/assistant. */
export function isOfflineCommand(raw: string): boolean {
  const { verb, arg } = parseCommand(raw);
  if (verb === "explain") return arg.toLowerCase() === "alerts";
  return verb === "help" || verb === "find" || verb === "item" || verb === "alerts" || verb === "suggest";
}

function isLiveBody(value: unknown): value is { text: string; draft?: unknown; citations?: unknown; notFound?: unknown; kind?: unknown; blocks?: unknown } {
  if (!value || typeof value !== "object") return false;
  const text = (value as { text?: unknown }).text;
  return typeof text === "string" && text.trim().length > 0;
}

function clipTurn(turn: LastTurn | undefined): LastTurn | undefined {
  if (!turn) return undefined;
  const question = turn.question.trim().slice(0, LAST_TURN_MAX_CHARS);
  const answer = turn.answer.trim().slice(0, LAST_TURN_MAX_CHARS);
  return question && answer ? { question, answer } : undefined;
}

async function postLive(payload: {
  command: string;
  caseCtx?: CaseContext;
  inventoryIds: string[];
  lastTurn?: LastTurn;
}): Promise<AssistantReply> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LIVE_TIMEOUT_MS);
  try {
    const res = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body: unknown = await res.json();
    if (!isLiveBody(body)) throw new Error("Bad assistant response");
    const reply: AssistantReply = { text: body.text };
    if (body.draft !== undefined && body.draft !== null) reply.draft = body.draft;
    if (Array.isArray(body.citations)) {
      reply.citations = body.citations.filter((id): id is string => typeof id === "string" && id.length > 0);
    }
    const localKind = (["emergency", "app", "formulary"] as const).find((kind) => kind === body.kind);
    if (localKind) {
      const record = body as Record<string, unknown>;
      const steps = Array.isArray(record.steps) ? record.steps.filter((step): step is string => typeof step === "string") : undefined;
      const actions = Array.isArray(record.actions)
        ? record.actions.filter(
            (action): action is ReplyAction =>
              Boolean(action) &&
              typeof action === "object" &&
              typeof (action as ReplyAction).label === "string" &&
              typeof (action as ReplyAction).to === "string",
          )
        : undefined;
      return {
        text: body.text,
        kind: localKind,
        draft: body.draft ?? undefined,
        notFound: false,
        citations: [],
        blocks: [],
        title: typeof record.title === "string" ? record.title : undefined,
        steps,
        actions,
        redFlag: typeof record.redFlag === "string" ? record.redFlag : undefined,
        badge: typeof record.badge === "string" ? record.badge : undefined,
      };
    }
    const kind = ANSWER_KINDS.find((k) => k === body.kind);
    if (typeof body.notFound === "boolean") reply.notFound = body.notFound;
    // Older servers send only notFound; infer the kind from it.
    reply.kind = kind ?? (reply.notFound ? "notFound" : "research");
    reply.notFound = reply.kind === "notFound";
    reply.blocks = reply.kind === "notFound" ? [] : parseBlocks(body.blocks);
    return reply;
  } finally {
    clearTimeout(timer);
  }
}

export const liveProvider: AssistantProvider = {
  name: "live",
  async ask(input) {
    const local = answerLocally(input.command, input.inventory, { caseOpen: Boolean(input.caseCtx) });
    // Keyword emergency, app help, and formulary never wait on a model.
    if (local && local.kind !== "general") return local;
    if (isOfflineCommand(input.command)) return offlineProvider.ask(input);
    try {
      const lastTurn = clipTurn(input.lastTurn);
      return await postLive({
        command: input.command.trim(),
        caseCtx: input.caseCtx,
        inventoryIds: input.inventory.map((item) => item.id),
        ...(lastTurn ? { lastTurn } : {}),
      });
    } catch {
      const offline = await offlineProvider.ask(input);
      return { ...offline, text: `${offline.text}\n${LIVE_FALLBACK_NOTE}` };
    }
  },
};

export function getProvider(): AssistantProvider {
  return import.meta.env.VITE_ASSISTANT_MODE === "live" ? liveProvider : offlineProvider;
}
