export function getMatchBand(score: number): { text: string; className: string } {
  if (score >= 85) return { text: "Don't Leave Without Meeting", className: "bg-success text-white" };
  if (score >= 70) return { text: "Strong Match", className: "bg-blue-500 text-white" };
  return { text: "Worth an Introduction", className: "bg-muted text-muted-foreground" };
}

export function getViewerReciprocityLabel(
  storedLabel: string | null,
  viewerIsUserA: boolean,
): string | null {
  if (viewerIsUserA || !storedLabel) return storedLabel;
  if (storedLabel === "They Can Help You") return "You Can Help Them";
  if (storedLabel === "You Can Help Them") return "They Can Help You";
  return storedLabel;
}
