import { ASSISTANT_DISCLAIMER, CONFIRM_BEFORE_GIVEN, DOSE_LINE } from "./copy.ts";
import { escapeRegExp, normalizePhrase } from "./text.ts";
import type { AssistantReply, KitName } from "./types.ts";

const STOP = new Set([
  "what",
  "dose",
  "dosage",
  "doses",
  "should",
  "could",
  "would",
  "give",
  "given",
  "take",
  "taking",
  "taken",
  "much",
  "many",
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "please",
  "medicine",
  "medication",
  "medicines",
  "medications",
  "drug",
  "drugs",
  "tablet",
  "tablets",
  "capsule",
  "capsules",
  "pill",
  "pills",
  "onboard",
  "crew",
  "some",
  "any",
  "from",
  "your",
  "their",
  "them",
  "they",
  "have",
  "when",
  "where",
  "about",
  "space",
  "flight",
  "surgeon",
  "pain",
  "chest",
  "help",
  "need",
  "using",
  "milligram",
  "milligrams",
]);

function aliases(item: KitName): string[] {
  return item.name
    .toLowerCase()
    .split(/[()/]/)
    .map((part) => part.replace(/[^a-z0-9]+/g, " ").trim())
    .filter((part) => part.length >= 3);
}

export function mentionsItem(text: string, item: KitName): boolean {
  const hay = normalizePhrase(text);
  return aliases(item).some((name) => new RegExp(`(?:^|\\s)${escapeRegExp(name)}(?:\\s|$)`).test(hay));
}

function doseCue(text: string): boolean {
  if (/\b(dose rate|dosimeter|radiation log|log radiation)\b/.test(text) && !/\b(mg|mcg|medicine|medication|tablet|capsule|pill)\b/.test(text)) {
    return false;
  }
  return /\b(dose|dosage|how much|how many|milligram|milligrams)\b/.test(text) || /\b\d+\s*(mg|mcg|ml)\b/.test(text);
}

function takeCue(text: string): boolean {
  return /\b(should i take|can i take|what should i take|give me|administer|how many tablets)\b/.test(text);
}

/** A medicine question: a named kit item, a dose, or a request to take or give something. */
export function isMedQuestion(raw: string, inventory: readonly KitName[]): boolean {
  const text = normalizePhrase(raw);
  if (!text) return false;
  const named = inventory.some((item) => mentionsItem(text, item));
  if (/\b(dose rate|dosimeter|radiation log|log radiation)\b/.test(text) && !named) return false;
  if (named) return true;
  if (doseCue(text)) return true;
  if (takeCue(text)) return true;
  return false;
}

function unknownDrug(text: string, inventory: readonly KitName[]): string | undefined {
  const words = text.match(/[a-z]{5,}/g) ?? [];
  for (const word of words) {
    if (STOP.has(word)) continue;
    if (inventory.some((item) => aliases(item).some((name) => name.split(" ").includes(word)))) continue;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }
  return undefined;
}

export function formularyReply(raw: string, inventory: readonly KitName[]): AssistantReply {
  const text = normalizePhrase(raw);
  const named = inventory.filter((item) => mentionsItem(text, item));
  const unique = [...new Map(named.map((item) => [item.id, item])).values()];
  if (unique.length) {
    const names = unique.map((item) => item.name).join(", ");
    return {
      kind: "formulary",
      badge: "Onboard kit only",
      title: "Onboard kit only",
      text: [
        DOSE_LINE,
        `${names} ${unique.length === 1 ? "is" : "are"} in the onboard kit. Pulseframe does not suggest a dose. ${CONFIRM_BEFORE_GIVEN}.`,
        ASSISTANT_DISCLAIMER,
      ].join("\n"),
      draft: {
        itemIds: unique.map((item) => item.id),
        rationale: `${names} ${unique.length === 1 ? "is" : "are"} in the onboard kit. No dose is suggested.`,
        cautions: "Confirm with the flight surgeon before anything is given.",
      },
    };
  }
  const missing = unknownDrug(text, inventory);
  const who = missing ? `${missing} is not in the onboard inventory. ` : "";
  return {
    kind: "formulary",
    badge: "Onboard kit only",
    title: "Onboard kit only",
    text: [
      DOSE_LINE,
      `${who}Pulseframe only names medicines that are in the onboard kit, and it does not suggest a dose.`,
      ASSISTANT_DISCLAIMER,
    ].join("\n"),
  };
}
