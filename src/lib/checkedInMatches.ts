export interface DirectionalScoredMatchRow {
  user_a_id: string;
  user_b_id: string;
  a_to_b_score: number | null;
  b_to_a_score: number | null;
  a_to_b_confidence: number | null;
  b_to_a_confidence: number | null;
}

export type ViewerScoredMatch<T> = T & {
  viewerScore: number;
  viewerConfidence: number;
};

export function getViewerMatchMetrics(
  row: DirectionalScoredMatchRow,
  currentUserId: string,
): { score: number | null; confidence: number | null } | null {
  if (row.user_a_id === currentUserId) {
    return { score: row.a_to_b_score, confidence: row.a_to_b_confidence };
  }
  if (row.user_b_id === currentUserId) {
    return { score: row.b_to_a_score, confidence: row.b_to_a_confidence };
  }
  return null;
}

export function selectTopCheckedInMatches<T extends DirectionalScoredMatchRow>(
  rows: T[],
  currentUserId: string,
  checkedInProfileIds: Set<string>,
  limit = 10,
): { eligibleCount: number; rows: Array<ViewerScoredMatch<T>> } {
  const eligible = rows
    .flatMap((row) => {
      const metrics = getViewerMatchMetrics(row, currentUserId);
      const otherId = row.user_a_id === currentUserId ? row.user_b_id : row.user_a_id;
      if (
        !metrics ||
        !checkedInProfileIds.has(otherId) ||
        metrics.score === null ||
        metrics.confidence === null ||
        metrics.score < 60 ||
        metrics.confidence < 70
      ) {
        return [];
      }
      return [{ ...row, viewerScore: metrics.score, viewerConfidence: metrics.confidence }];
    })
    .sort((a, b) => b.viewerScore - a.viewerScore);

  return { eligibleCount: eligible.length, rows: eligible.slice(0, limit) };
}
