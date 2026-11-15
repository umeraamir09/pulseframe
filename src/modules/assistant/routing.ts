import type { AppGuideEntry } from "../../knowledge/app-guide.ts";
import { matchGeneral } from "../../knowledge/general.ts";
import { ASSISTANT_DISCLAIMER, GENERAL_LABEL } from "./copy.ts";
import { emergencyReply, isEmergencyReport } from "./emergency.ts";
import { formularyReply, isMedQuestion } from "./formulary.ts";
import { matchAppGuide } from "./guide.ts";
import type { AssistantReply, KitName } from "./types.ts";

export type { AssistantReply, KitName, ReplyAction, ReplyKind } from "./types.ts";

export interface LocalOptions {
  /** When a case is already open, the emergency card says so. */
  caseOpen?: boolean;
  /**
   * Offline answers a reasonable question even with no matching note.
   * The live path leaves those for the model so a research hit can still be cited.
   */
  fallbackGeneral?: boolean;
}

const STATION_VERBS = new Set(["help", "find", "item", "alerts", "suggest"]);

export function isStationCommand(command: string): boolean {
  const trimmed = command.trim().toLowerCase();
  const verb = trimmed.split(/\s+/)[0] ?? "";
  if (verb === "explain" && trimmed.startsWith("explain alerts")) return true;
  return STATION_VERBS.has(verb);
}

function appReply(entry: AppGuideEntry): AssistantReply {
  const actions = entry.path ? [{ label: `Open ${entry.title}`, to: entry.path }] : [];
  return {
    kind: "app",
    badge: "App help",
    title: entry.title,
    steps: [entry.about, ...entry.steps],
    actions,
    text: [`App help: ${entry.title}`, entry.about, ...entry.steps, ASSISTANT_DISCLAIMER].join("\n"),
  };
}

function generalReply(title: string, body: string): AssistantReply {
  return {
    kind: "general",
    badge: GENERAL_LABEL,
    title,
    text: `${GENERAL_LABEL}. ${body}\n${ASSISTANT_DISCLAIMER}`,
  };
}

const GENERAL_FALLBACK =
  "I can share a short note on spaceflight topics such as microgravity, radiation, sleep, and exercise. For a symptom, describe what is happening and Emergency opens. For a medicine, only the onboard kit is named, and no dose is suggested.";

/** Question-shaped text with real words, not a random string. */
export function looksLikeQuestion(raw: string): boolean {
  const trimmed = raw.trim().toLowerCase();
  const words = trimmed.match(/[a-z]{3,}/g) ?? [];
  const vowels = words.filter((word) => /[aeiou]/.test(word));
  if (vowels.length < 2) return false;
  return /\?/.test(raw) || /^(what|why|how|when|where|who|is|are|can|does|do|should|could|tell|explain)\b/.test(trimmed);
}

/**
 * Rule-based answer used with no model: emergency first, then app help,
 * then formulary-only medicine questions, then a short general note.
 * Station commands (help, find, item, alerts, suggest) return undefined so the
 * existing command handlers keep running.
 */
export function answerLocally(
  command: string,
  inventory: readonly KitName[],
  options: LocalOptions = {},
): AssistantReply | undefined {
  if (isStationCommand(command)) return undefined;
  if (isEmergencyReport(command)) return emergencyReply(command, options.caseOpen);
  const guide = matchAppGuide(command);
  if (guide) return appReply(guide);
  if (isMedQuestion(command, inventory)) return formularyReply(command, inventory);
  const note = matchGeneral(command);
  if (note) return generalReply(note.title, note.text);
  if (options.fallbackGeneral && looksLikeQuestion(command)) return generalReply("General note", GENERAL_FALLBACK);
  return undefined;
}
