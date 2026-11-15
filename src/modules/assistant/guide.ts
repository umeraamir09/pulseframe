import { APP_GUIDE, type AppGuideEntry } from "../../knowledge/app-guide.ts";
import { hasPhrase, normalizePhrase } from "./text.ts";

const HOW_TO = /^(how |where |what |show |explain |when )/;

function scoreEntry(text: string, entry: AppGuideEntry): number {
  let score = 0;
  for (const keyword of entry.keywords) {
    if (hasPhrase(text, keyword)) score += keyword.includes(" ") ? 3 : 1;
  }
  return score;
}

/**
 * Match a how-to question to a page. Needs a question frame or a page word,
 * and at least two points, so a passing mention of "radiation" does not steal a general question.
 */
export function matchAppGuide(question: string): AppGuideEntry | undefined {
  const text = normalizePhrase(question);
  if (!text) return undefined;
  const howto = HOW_TO.test(text);
  const pageWord = /\b(page|screen|button|menu|dock|tab|log|checklist|dashboard|sync|command)\b/.test(text);
  let best: { entry: AppGuideEntry; score: number } | undefined;
  for (const entry of APP_GUIDE) {
    const score = scoreEntry(text, entry);
    if (!best || score > best.score) best = { entry, score };
  }
  if (!best || best.score < 2) return undefined;
  if (!howto && !pageWord && best.score < 3) return undefined;
  return best.entry;
}

export function isAppUseQuestion(question: string): boolean {
  const text = normalizePhrase(question);
  return HOW_TO.test(text);
}
