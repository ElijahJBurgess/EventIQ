function normalizeCompany(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Names of the other checked-in attendees whose company matches the viewer's
 * own (case-insensitive, whitespace-trimmed). Returns nothing when the viewer's
 * own company is blank. Used as a client-side backstop over the
 * `home_company_colleagues` RPC.
 */
export function companyColleagueNames(
  viewerCompany: string | null | undefined,
  others: Array<{ full_name: string | null; company: string | null }>,
): string[] {
  const mine = normalizeCompany(viewerCompany);
  if (!mine) return [];
  return others
    .filter((other) => normalizeCompany(other.company) === mine)
    .map((other) => (other.full_name ?? "").trim())
    .filter(Boolean);
}

/**
 * The "Your company is in the room" banner sentence, or null when there is
 * nothing to show. One colleague is named; two or more are counted.
 */
export function formatCompanyInRoom(names: string[], company: string | null | undefined): string | null {
  const clean = names.map((name) => name.trim()).filter(Boolean);
  const label = (company ?? "").trim();
  if (clean.length === 0 || !label) return null;
  if (clean.length === 1) return `${clean[0]} from ${label} is here`;
  return `${clean.length} people from ${label} are here`;
}

/**
 * The "Don't Leave Without Meeting" heading, personalized with the single top
 * match's name when there is exactly one; generic otherwise.
 */
export function dontLeaveWithoutMeetingHeading(topMatches: Array<{ name: string }>): string {
  const base = "Don't Leave Without Meeting";
  if (topMatches.length !== 1) return base;
  const name = topMatches[0].name.trim();
  return name ? `${base} ${name}` : base;
}
