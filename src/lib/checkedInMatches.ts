export interface ScoredMatchRow {
  user_a_id: string;
  user_b_id: string;
  match_score: number | null;
}

export function selectTopCheckedInMatches<T extends ScoredMatchRow>(
  rows: T[],
  currentUserId: string,
  checkedInProfileIds: Set<string>,
  limit = 10,
) {
  const eligible = rows
    .filter((row) => {
      const otherId = row.user_a_id === currentUserId ? row.user_b_id : row.user_a_id;
      return checkedInProfileIds.has(otherId);
    })
    .sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0));

  return { eligibleCount: eligible.length, rows: eligible.slice(0, limit) };
}
