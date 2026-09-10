/**
 * The short tag chips shown on a Matches card: the match's shared industries
 * first, then its shared interests, de-duplicated case-insensitively and capped
 * (~3) so the card stays scannable. Same source data the card has always used —
 * just flattened into one list instead of a "Shared: …" blob plus interests.
 */
export function buildMatchTags(
  sharedIndustries: string[],
  sharedInterests: string[],
  limit = 3,
): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of [...sharedIndustries, ...sharedInterests]) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(value);
    if (tags.length >= limit) break;
  }
  return tags;
}
