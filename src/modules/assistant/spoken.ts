import { isEmergencyReport } from "./emergency.ts";

/**
 * Turns a spoken sentence into one of the assistant's commands
 * (help, find <text>, item <id>, alerts, suggest). Pure, so it is unit-tested.
 * A symptom report is left as spoken so emergency routing can see it.
 */
export function spokenToCommand(raw: string): string {
  if (isEmergencyReport(raw)) return raw.trim();
  const text = raw
    .toLowerCase()
    .replace(/[.,!?;:"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";

  const known = /^(help|find|item|alerts|suggest)\b/;
  if (known.test(text)) return text;

  const search = text.match(/^(?:search(?: for)?|look(?:ing)? for|where is|where's|do we have|is there)\s+(?:an?\s+|the\s+|any\s+)?(.+)$/);
  if (search) return `find ${search[1]}`;

  const item = text.match(/^(?:show|open|details for|tell me about)\s+item\s+(.+)$/);
  if (item) return `item ${item[1].replace(/\s+/g, "-")}`;

  if (/\balerts?\b/.test(text)) return "alerts";
  if (/\b(suggest|suggestion|recommend|what should i (?:take|give|use))\b/.test(text)) return "suggest";
  if (/\b(help|commands|what can you do)\b/.test(text)) return "help";
  return text;
}
