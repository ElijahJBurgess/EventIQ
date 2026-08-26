// "Save for later" bookmarking, built on the match_actions table's existing
// 'match_saved' action_type. Saving inserts a row; unsaving deletes it
// (DELETE RLS policy added in supabase/migrations/20260825010000).

import { supabase } from "@/integrations/supabase/client";

export async function fetchSavedMatchIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("match_actions")
    .select("match_id")
    .eq("user_id", userId)
    .eq("action_type", "match_saved");
  return new Set((data ?? []).map((row) => row.match_id).filter((id): id is string => Boolean(id)));
}

export async function saveMatch(matchId: string, userId: string): Promise<boolean> {
  const { error } = await supabase.from("match_actions").insert({
    match_id: matchId,
    user_id: userId,
    action_type: "match_saved",
  });
  return !error;
}

export async function unsaveMatch(matchId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from("match_actions")
    .delete()
    .eq("match_id", matchId)
    .eq("user_id", userId)
    .eq("action_type", "match_saved");
  return !error;
}
