/** Lowercase, expand a few contractions, and collapse punctuation to spaces. */
export function normalizePhrase(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\u2019']/g, "'")
    .replace(/\bcan't\b/g, "cannot")
    .replace(/\bcant\b/g, "cannot")
    .replace(/\bwon't\b/g, "will not")
    .replace(/\bwont\b/g, "will not")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Phrase match on normalized text, at a word boundary. */
export function hasPhrase(text: string, phrase: string): boolean {
  const hay = normalizePhrase(text);
  const needle = normalizePhrase(phrase);
  if (!needle) return false;
  return new RegExp(`(?:^|\\s)${escapeRegExp(needle)}(?:\\s|$)`).test(hay);
}
