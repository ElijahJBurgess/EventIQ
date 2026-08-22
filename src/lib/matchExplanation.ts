import type { DirectionalEvidenceItem, MatchDetailResult } from "@/lib/matchDetail";

export interface ClickPair {
  labelA: string;
  labelB: string;
}

export interface FullProfileExplanation {
  whyThisMakesSense: string;
  whyItClicks: ClickPair[];
  whatYouCanOfferThem: string[];
  whatTheyCanOfferYou: string[];
}

const COMPONENT_PRIORITY: Record<string, number> = {
  goalToValueFit: 7,
  targetPersonFit: 6,
  needToOfferFit: 5,
  expertiseFit: 4,
  opportunityCompatibility: 3,
  timingConnectionFit: 2,
  contextFit: 1,
};

const normalize = (value: string) => value.trim().toLowerCase();

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalize(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function validEvidence(items: DirectionalEvidenceItem[]): DirectionalEvidenceItem[] {
  return items
    .filter((item) => item.score > 0 && item.viewerValue.trim() && item.candidateValue.trim())
    .sort((a, b) => (COMPONENT_PRIORITY[b.component] ?? 0) - (COMPONENT_PRIORITY[a.component] ?? 0) || b.score - a.score);
}

function firstName(fullName: string | null): string {
  return (fullName ?? "").trim().split(/\s+/)[0] || "This person";
}

function explainItem(item: DirectionalEvidenceItem, otherName: string): string {
  if (item.component === "goalToValueFit") {
    return `${otherName}'s ${item.candidateValue} supports your goal of ${item.viewerValue}.`;
  }
  if (item.component === "targetPersonFit") {
    return `${otherName} matches your ${item.viewerValue} preference through ${item.candidateValue}.`;
  }
  if (item.component === "needToOfferFit") {
    return `${otherName} can offer ${item.candidateValue}, matching your need for ${item.viewerValue}.`;
  }
  if (item.component === "expertiseFit") {
    return `${otherName} offers ${item.candidateValue}, matching the expertise you are seeking.`;
  }
  return `${otherName}'s ${item.candidateValue} aligns with your ${item.viewerValue}.`;
}

export function buildWhyThisMakesSense(matchDetail: MatchDetailResult): string {
  const items = validEvidence(matchDetail.match.directionalEvidence).slice(0, 3);
  if (!items.length) return "No scored directional evidence is available for this recommendation yet.";
  const otherName = firstName(matchDetail.otherPerson.full_name);
  return items.map((item) => explainItem(item, otherName)).join(" ");
}

export function buildWhyItClicks(matchDetail: MatchDetailResult): ClickPair[] {
  const seen = new Set<string>();
  return validEvidence(matchDetail.match.directionalEvidence).flatMap((item) => {
    const key = `${normalize(item.viewerValue)}|${normalize(item.candidateValue)}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ labelA: item.viewerValue, labelB: item.candidateValue }];
  });
}

const OFFER_FIELDS = new Set(["offers", "expertise_offered", "areas_of_expertise", "role_details", "open_opportunity"]);

export function buildWhatYouCanOfferThem(matchDetail: MatchDetailResult): string[] {
  return unique(validEvidence(matchDetail.match.reverseEvidence).filter((item) => OFFER_FIELDS.has(item.candidateField)).map((item) => item.candidateValue));
}

export function buildWhatTheyCanOfferYou(matchDetail: MatchDetailResult): string[] {
  return unique(validEvidence(matchDetail.match.directionalEvidence).filter((item) => OFFER_FIELDS.has(item.candidateField)).map((item) => item.candidateValue));
}

export function buildFullProfileExplanation(matchDetail: MatchDetailResult): FullProfileExplanation {
  return {
    whyThisMakesSense: buildWhyThisMakesSense(matchDetail),
    whyItClicks: buildWhyItClicks(matchDetail),
    whatYouCanOfferThem: buildWhatYouCanOfferThem(matchDetail),
    whatTheyCanOfferYou: buildWhatTheyCanOfferYou(matchDetail),
  };
}
