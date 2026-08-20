export type NotificationDestination =
  | { tab: "messages"; matchId: string | null }
  | { tab: "myday" };

export function notificationDestination(item: { type: string; match_id: string | null }): NotificationDestination | null {
  switch (item.type) {
    case "connection_request":
    case "new_message":
    case "meeting_requested":
    case "meeting_accepted":
    case "meeting_declined":
      return { tab: "messages", matchId: item.match_id };
    case "meeting_scheduled":
      return { tab: "myday" };
    default:
      return null;
  }
}
