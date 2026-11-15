import type { InventoryItem, SkeletonRegionId } from "../../contracts";
import { KEY_LABELS } from "../../contracts";
import { explainAlert, missionDayLabel, missionDayOf, SIM_CREW, store } from "../../data/db";
import { getProtocol, matchProtocol } from "../protocols";
import { LIVE_FALLBACK_NOTE, NO_ONBOARD_ITEM, NO_OPEN_CASE_REPLY, PROVENANCE_LABEL } from "./copy";

export interface CaseContext {
  caseId: string;
  crewId: string;
  narrative: string;
  regionIds: SkeletonRegionId[];
  protocolId?: string;
}

export interface AssistantAsk {
  command: string;
  caseCtx?: CaseContext;
  inventory: InventoryItem[];
}

export interface AssistantReply {
  text: string;
  draft?: unknown;
}

export interface AssistantProvider {
  name: "offline" | "live";
  ask(input: AssistantAsk): Promise<AssistantReply>;
}

export const LIVE_TIMEOUT_MS = 8000;

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
    "suggest — items named on the open case's protocol card, onboard kit only",
    "find <text> — search item name and PDF comments",
    "item <id> — show one onboard item",
    "alerts — list open alerts",
    "help — list these commands",
    "Pulseframe does not suggest a dose. A flight surgeon directs anything given.",
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
    const { verb, arg } = parseCommand(input.command);
    if (verb === "help") return { text: helpText() };
    if (verb === "find") return { text: findText(input.inventory, arg) };
    if (verb === "item") return { text: itemText(input.inventory, arg) };
    if (verb === "alerts" || (verb === "explain" && arg.toLowerCase() === "alerts")) {
      return { text: await alertsText(input.caseCtx?.crewId ?? SIM_CREW.id) };
    }
    if (verb === "suggest") return suggest(input);
    return { text: `Unknown command "${verb}". Try help.` };
  },
};

function isLiveBody(value: unknown): value is { text: string; draft?: unknown } {
  if (!value || typeof value !== "object") return false;
  const text = (value as { text?: unknown }).text;
  return typeof text === "string" && text.trim().length > 0;
}

async function postLive(payload: { command: string; caseCtx?: CaseContext; inventoryIds: string[] }): Promise<{
  text: string;
  draft?: unknown;
}> {
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
    return { text: body.text, draft: body.draft };
  } finally {
    clearTimeout(timer);
  }
}

export const liveProvider: AssistantProvider = {
  name: "live",
  async ask(input) {
    try {
      return await postLive({
        command: input.command,
        caseCtx: input.caseCtx,
        inventoryIds: input.inventory.map((item) => item.id),
      });
    } catch {
      const offline = await offlineProvider.ask(input);
      return { text: `${offline.text}\n${LIVE_FALLBACK_NOTE}`, draft: offline.draft };
    }
  },
};

export function getProvider(): AssistantProvider {
  return import.meta.env.VITE_ASSISTANT_MODE === "live" ? liveProvider : offlineProvider;
}
