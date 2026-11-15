import type { SkeletonRegionId } from "../../contracts/index.ts";
import { GENERAL_FALLBACK_ID, matchProtocol, type ProtocolCard } from "../protocols/index.ts";
import { emergencyHref } from "../emergency/prefill.ts";
import { ASSISTANT_DISCLAIMER, RED_FLAG_LINE } from "./copy.ts";
import { normalizePhrase } from "./text.ts";
import type { AssistantReply } from "./types.ts";

interface Rule {
  re: RegExp;
  region?: SkeletonRegionId;
}

/**
 * Symptom and emergency phrases. Checked with no model.
 * Patterns run on normalized text (contractions expanded, punctuation turned into spaces).
 */
const RULES: Rule[] = [
  {
    re: /\b(chest pain|chest tightness|chest pressure|tight chest|heart attack|crushing pain|pain in (?:my |the |their )?(?:left |right )?chest)\b/,
    region: "chest",
  },
  {
    re: /\b(cannot breathe|cannot breath|difficulty breathing|hard to breathe|trouble breathing|short of breath|shortness of breath|not breathing|stopped breathing|stop breathing|gasping)\b/,
    region: "chest",
  },
  { re: /\b(choking|choke|cannot speak|airway blocked|food stuck)\b/, region: "head" },
  { re: /\b(bleeding|bleed|laceration|gash|spurting|hemorrhage|open wound)\b/ },
  { re: /\b(smoke|fire|flame|burned|burning|burns|scald|on fire)\b/, region: "skin" },
  { re: /\b(unconscious|unresponsive|passed out|lose consciousness|lost consciousness|not conscious|collapsed|blacked out)\b/ },
  { re: /\b(severe pain|worst pain|extreme pain|unbearable pain|hard pain)\b/ },
  {
    re: /\b(eye injury|eye pain|injured eye|something in (?:my |the |their )?eye|foreign body|debris in (?:my |the )?eye|scratched eye)\b/,
    region: "head",
  },
  { re: /\b(headache|head pain|migraine)\b/, region: "head" },
  { re: /\b(nausea|vomiting|vomit|motion sickness)\b/, region: "abdomen" },
  { re: /\b(seizure|stroke|anaphylaxis|allergic reaction)\b/ },
  { re: /\bchest\b[^.?]{0,30}\b(hurts|hurt|aching|ache)\b/, region: "chest" },
  { re: /\b(hurts|hurt|aching|ache)\b[^.?]{0,30}\bchest\b/, region: "chest" },
];

const BODY: { re: RegExp; region: SkeletonRegionId }[] = [
  { re: /\bchest\b/, region: "chest" },
  { re: /\b(eye|head|headache)\b/, region: "head" },
  { re: /\b(stomach|abdomen|nausea)\b/, region: "abdomen" },
  { re: /\b(burned|burning|burns|smoke|fire|flame|skin)\b/, region: "skin" },
];

/** A background question, not something happening to the crew right now. */
const KNOWLEDGE = /^(what (helps|causes|is|are|does|can cause)|how does|why (do|does|is|are))\b/;

/** True when the message should open Emergency before any other answer. */
export function isEmergencyReport(raw: string): boolean {
  const text = normalizePhrase(raw);
  if (!text || !RULES.some((rule) => rule.re.test(text))) return false;
  if (KNOWLEDGE.test(text)) return false;
  return true;
}

function regionFor(text: string, rule: Rule | undefined): SkeletonRegionId | undefined {
  for (const body of BODY) {
    if (body.re.test(text)) return body.region;
  }
  return rule?.region;
}

function matchedCard(text: string, regionId: SkeletonRegionId | undefined): ProtocolCard | undefined {
  const card = matchProtocol(text, regionId ? [regionId] : []);
  return card.id === GENERAL_FALLBACK_ID ? undefined : card;
}

export function emergencyReply(raw: string, caseOpen = false): AssistantReply {
  const text = normalizePhrase(raw);
  const rule = RULES.find((item) => item.re.test(text));
  const regionId = regionFor(text, rule);
  const card = matchedCard(text, regionId);
  const situation = raw.replace(/\s+/g, " ").trim().slice(0, 500);
  const href = emergencyHref(situation, regionId);
  const steps = [
    "Open Emergency. The button fills in what you just said, and the body region when we know it.",
    "Follow the 8 steps: Situation, Pinpoint, Check, Differential, Tests, Steps, Kit, and Send.",
    card
      ? `Matching card: ${card.title}. Open that card from the button below.`
      : "No protocol card matched these words. Emergency still starts the case.",
  ];
  if (caseOpen) {
    steps.push("A case is already open, so Emergency shows that case. Close it first if this is a new problem.");
  }
  const actions = [
    { label: "Open Emergency", to: href },
    ...(card ? [{ label: `Open ${card.title}`, to: href }] : []),
  ];
  return {
    kind: "emergency",
    badge: "Emergency",
    title: card ? card.title : "Open Emergency",
    steps,
    actions,
    redFlag: RED_FLAG_LINE,
    text: [
      "Open Emergency now.",
      card ? `Matching card: ${card.title}.` : "No protocol card matched. Start the case anyway.",
      RED_FLAG_LINE,
      ASSISTANT_DISCLAIMER,
    ].join("\n"),
  };
}
