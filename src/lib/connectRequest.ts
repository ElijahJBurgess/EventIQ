// The one connect-request mechanism used app-wide (originally inline in
// MatchesTab's MatchCard). Extracted so Full Profile View's "Make the
// Intro" can call the exact same real flow instead of building a second
// one: insert a `messages` row (message_type: "connect_request"), then log
// a `match_actions` row (action_type: "message_sent"). A unique-constraint
// violation means a connect message for this match already exists (e.g.
// sent from another tab/device) and is treated as already-sent, not a
// failure -- callers should show the same "sent" state either way.

import { supabase } from "@/integrations/supabase/client";

export type ConnectRequestResult =
  | { status: "sent" }
  | { status: "already_sent" }
  | { status: "error"; message: string };

export interface SendConnectRequestParams {
  matchId: string;
  eventId: string | null;
  senderId: string;
  recipientId: string;
  content: string;
}

export async function sendConnectRequest({
  matchId,
  eventId,
  senderId,
  recipientId,
  content,
}: SendConnectRequestParams): Promise<ConnectRequestResult> {
  const { error: messageError } = await supabase.from("messages").insert({
    match_id: matchId,
    event_id: eventId,
    sender_id: senderId,
    recipient_id: recipientId,
    content,
    message_type: "connect_request",
  });

  if (messageError) {
    if (messageError.code === "23505") {
      return { status: "already_sent" };
    }
    return { status: "error", message: messageError.message };
  }

  const { error: actionError } = await supabase.from("match_actions").insert({
    match_id: matchId,
    action_type: "message_sent",
    user_id: senderId,
  });
  if (actionError) console.error("match_actions insert failed:", actionError);

  return { status: "sent" };
}
